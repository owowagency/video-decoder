import { Demuxer, load } from '@crate/demuxer';
import Pages from './Pages';
import WebGLRenderer from './WebGLRenderer';
import EventEmitter from '../util/EventEmitter';
import { FullOptions } from '../Options';
import Renderer from '../Renderer'
import Logger from '../util/Logger';

interface MyVideoDecoderConfig extends VideoDecoderConfig {
    codedWidth: number;
    codedHeight: number;
}

interface FrameEventData  {
    frame: number,
    bitmap: ImageBitmap,
}

interface ErrorEventData  {
    error?: string | Error,
}

interface FirstRenderEventData  {
    error?: string | Error,
}

interface WebWorkerDecoderEventMap {
    'frame': FrameEventData,
    'error': ErrorEventData,
    'first-render': FirstRenderEventData,
}

class WebWorkerDecoder {
    readonly emitter = new EventEmitter<WebWorkerDecoderEventMap>();
    private readonly decoder: VideoDecoder;
    private readonly renderer: WebGLRenderer;
    readonly count: number;
    private readonly pages: Pages;
    private readonly ahead;
    private readonly behind;
    private demuxer: Demuxer | null;
    private currentFrame: number | undefined;
    private requestedFrame: number | null = null;
    private realRenderer: Renderer | null = null;
    private firstRender = true;

    constructor(
        private readonly logger: Logger,
        demuxer: Demuxer,
        config: MyVideoDecoderConfig,
        options: FullOptions,
    ) {
        this.demuxer = demuxer;
        this.ahead = options.postBufferSize;
        this.behind = options.preBufferSize;
        const canvas = new OffscreenCanvas(config.codedWidth, config.codedHeight);
        
        this.renderer = new WebGLRenderer(canvas);
        
        const count = demuxer.frameCount();
        this.pages = new Pages(count, options.pageSize);
        this.count = count;
        this.decoder = new VideoDecoder({
            output: this.onFrame.bind(this),
            error: this.onError.bind(this)
        });
        this.decoder.configure(config);
        this.decoder.addEventListener('dequeue', this.onDequeue.bind(this));
    }

    private onDequeue() {
        const requested = this.requestedFrame;
        if (requested !== null) {
            this.logger.timeEnd('decoder still busy, waiting...');
            this.goto(requested, true);
        }
    }

    private onFrame(frame: VideoFrame) {
        const idx = this.demuxer?.timestampToFrame(frame.timestamp);

        if (typeof idx !== 'number') {
            this.logger.warn('Failed to get frame number', frame.timestamp);
            frame.close();
            return;
        }

        const currentPage = typeof this.currentFrame === 'number' ? this.pages.getPageNumber(this.currentFrame) : undefined;
        const framePage = this.pages.getPageNumber(idx);

        if (typeof currentPage === 'number') {
            const start = currentPage - this.behind;
            const end = currentPage + this.ahead;
            if (!(framePage >= start && framePage <= end)) {
                frame.close();
                return;
            }
        }

        const inCache = this.pages.getFrame(idx);
        const shouldDraw = this.requestedFrame === null;
        if (!inCache) {
            this.renderer.draw(frame);
            // TODO: Very slow on firefox (Slow on Safari <= 16, acceptable on >= 17 but still slower than chrome)
            // https://bugzilla.mozilla.org/show_bug.cgi?id=1864882
            const bitmap = this.renderer.transferToImageBitmap();
            this.pages.set(idx, bitmap);
            if (idx === this.currentFrame && shouldDraw) {
                this.draw(idx, bitmap);
            }
        } else {
            if (idx === this.currentFrame && shouldDraw) {
                this.draw(idx, inCache)
            }
        }

        frame.close();
    }

    private onError(error: Error) {
        this.emitter.dispatch('error', {error});
    }

    setRenderer(renderer: Renderer) {
        this.realRenderer = renderer;
    }

    goto(frame: number, force: boolean) {
        if (force) {
            this.requestedFrame = null;
        }

        if (!force && this.currentFrame === frame) {
            // We don't have to do anything, we are already on this frame
            return;
        }

        const currentPage = typeof this.currentFrame === 'number' ? this.pages.getPageNumber(this.currentFrame) : undefined;
        const newPage = this.pages.getPageNumber(frame);

        this.currentFrame = frame;

        if (currentPage === newPage) {
            // We should already have this frame
            const bitmap = this.pages.getFrame(frame);
            if (bitmap && !force) {
                this.draw(frame, bitmap);
                return;
            }
        }

        // Clean up pages before
        for (let idx = 0; idx < Math.max(0, newPage - this.behind); idx += 1) {
            this.pages.free(idx);
        }

        // Clean up pages ahead
        for (let idx = Math.min(this.pages.size, newPage + this.ahead); idx < this.pages.size; idx += 1) {
            this.pages.free(idx);
        }

        const start = Math.max(0, newPage - this.behind);
        const end = Math.min(this.pages.size, newPage + this.ahead);

        if (this.decoder.decodeQueueSize > 0) {
            if (this.requestedFrame === null) {
                this.logger.time('decoder still busy, waiting...');
            }
            this.requestedFrame = frame;
            return;
        }

        for (let idx = start; idx < end; idx += 1) {
            const page = this.pages.getPage(idx);

            if (!page) {
                continue;
            }

            if (page.complete) {
                continue;
            }

            this.demuxer?.decode(page.from, page.to, this.decoder) || 0;
        }
    }

    private draw(frame: number, bitmap: ImageBitmap) {
        const renderer = this.realRenderer;
        if (renderer) {
            renderer.draw(frame, bitmap);
            if (this.firstRender) {
                this.emitter.dispatch('first-render', {});
                this.firstRender = false;
            }
        }
    }

    free() {
        this.realRenderer = null;
        this.pages.freeAll();
        this.decoder.close();
        this.demuxer?.free();
        this.emitter.close();
    }

    static async load(tag: string, url: string, options: FullOptions, signal: AbortSignal): Promise<WebWorkerDecoder> {
        const logger = new Logger(tag);
        logger.time('load video file');
        const response = await fetch(url, {
            signal
        });
        const contentLength = parseInt(response.headers.get('Content-Length') || '0');
        logger.log('video content length', contentLength, `${contentLength * 0.000001}mb`);
        const buffer = await response.arrayBuffer();
        logger.timeEnd('load video file');
        logger.time('demux');
        const demuxer = load(buffer, WebWorkerDecoder.getContentType(response));
        logger.timeEnd('demux');
        const config: MyVideoDecoderConfig = {
            codec: demuxer.codec() || options.codec,
            codedWidth: demuxer.codedWidth(),
            codedHeight: demuxer.codedHeight(),
        }
        
        const supported = await VideoDecoder.isConfigSupported(config);

        if (supported.supported !== true) {
            throw new Error('Not supported');
        }

        return new WebWorkerDecoder(logger, demuxer, config, options);
    }

    private static getContentType(response: Response): string {
        const type = response.headers.get('Content-Type');
        const fallback = 'mp4';

        if (typeof type === 'string') {
            const pattern = /^video\/(?<format>.*)$/;
            const match = type.match(pattern);
            if (match && match.groups) {
                switch (match.groups['format']) {
                    case 'mkv':
                    case 'webm': return 'mkv';
                    case 'mp4': return 'mp4';
                    default: return fallback;
                }
            }
        }

        return fallback;
    }
}

export default WebWorkerDecoder;