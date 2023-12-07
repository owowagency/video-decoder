import { RequestMessage } from "./Message";
import { FullOptions } from "../Options";
import WebWorkerDecoder from "./WebWorkerDecoder";
import Renderer from '../Renderer';

class DecoderEntry {
    private readonly controller = new AbortController();
    private decoder: WebWorkerDecoder | null = null;

    private requestedFrame: number | null = null;
    private renderer: Renderer | null = null;

    constructor(private readonly key: string, private readonly url: string, private readonly options: FullOptions) {

    }

    private setDecoder(decoder: WebWorkerDecoder) {
        this.decoder = decoder;
        decoder.emitter.on('error', (data) => {
            postMessage({
                type: 'response:error',
                key: this.key,
                error: data.error,
            });
        });
        decoder.emitter.on('first-render', () => {
            postMessage({
                type: 'response:first-render',
                key: this.key
            });
        })
        decoder.emitter.on('frame', (data) => {
            postMessage({
                type: 'response:frame',
                key: this.key,
                frame: data.frame,
                bitmap: data.bitmap,
            }, {transfer: [data.bitmap]});
        });
    }

    load() {
        WebWorkerDecoder
            .load(this.key, this.url, this.options, this.controller.signal)
            .then((decoder: WebWorkerDecoder) => {
                if (this.controller.signal.aborted) {
                    return Promise.reject(this.controller.signal.reason);
                }

                if (this.renderer !== null) {
                    decoder.setRenderer(this.renderer);
                }

                if (this.requestedFrame !== null) {
                    decoder.goto(this.requestedFrame, false);
                }

                this.setDecoder(decoder);

                postMessage({
                    type: 'response:loaded',
                    key: this.key,
                    count: decoder.count,
                })
            })
            .catch((error?: Error | string) => {
                postMessage({
                    type: 'response:error', 
                    key: this.key,
                    error: typeof error === 'string' 
                        ? error 
                        : (error ? String(error) : undefined)
                });
            });
    }

    goto(frame: number) {
        this.requestedFrame = frame;
        this.decoder?.goto(frame, false);
    }

    setRenderer(renderer: Renderer) {
        this.renderer = renderer;
        this.decoder?.setRenderer(renderer);
    }

    dispose() {
        this.controller.abort();
        this.requestedFrame = null;
        this.renderer = null;
        this.decoder?.free();
        this.decoder = null;
    }
}

const entries: Record<string, DecoderEntry> = {};

const onLoad = (key: string, url: string, options: FullOptions) => {
    const entry = entries[key] = new DecoderEntry(key, url, options);
    entry.load();
}

const onDispose = (key: string) => {
    const entry = entries[key];
    entry?.dispose();
    delete entries[key];
}

const onGoto = (key: string, frame: number) => {
    const entry = entries[key];
    entry?.goto(frame);
}

const onSetCanvas = (key: string, code: string, canvas?: OffscreenCanvas) => {
    if (!canvas) {
        postMessage({type: 'response:error', key, error: `No canvas transferred`})
        return;
    }

    // TODO: Find a better way to move a class/function that is defined outside the package to the WebWorker without doing this:
    const decodedCode = atob(code);
    const constructorProvider = new Function(`
        ${decodedCode}
        return Renderer;    
    `);
    
    const Renderer = constructorProvider();
    const renderer = new Renderer(canvas) as Renderer;


    const entry = entries[key];
    entry?.setRenderer(renderer);
}

const canvasCache: Record<string, OffscreenCanvas> = {};

const getCanvas = (canvasId?: string, canvas?: OffscreenCanvas): OffscreenCanvas | undefined => {
    if (canvas && canvasId) {
        canvasCache[canvasId] = canvas;
        return canvas;
    }

    if (canvasId) {
        return canvasCache[canvasId];
    }

    return undefined;
}

onmessage = (message: MessageEvent<RequestMessage>) => {
    const data = message.data;
    switch (data.type) {
        case 'request:load':
            onLoad(data.key, data.url, data.options);
            break;
        case 'request:dispose':
            onDispose(data.key);
            break;
        case 'request:frame':
            onGoto(data.key, data.frame);
            break;
        case "request:set-canvas":
            onSetCanvas(data.key, data.code, getCanvas(data.canvasId, data.canvas));
            break;

    }
}

postMessage({type: 'response:ready'});