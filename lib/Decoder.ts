import EventEmitter from "./util/EventEmitter";
import { FullOptions, Options } from "./Options";
import Worker from './Worker';
import IdGenerator from "./util/IdGenerator";
import { RequestMessage, ResponseMessage } from "./worker/Message";

interface LoadEventData {
    width: number,
    height: number,
    count: number,
}

interface FirstRenderEventData {

}

interface ErrorEventData {
    error?: string,
}

interface DecoderEventMap {
    'first-render': FirstRenderEventData,
    'loaded': LoadEventData,
    'error': ErrorEventData,
}

function mergeWithDefaults(options: Options): FullOptions {
    return {
        codec: options.codec,
        pageSize: Math.max(1, typeof options.pageSize === 'number' ? options.pageSize : 10),
        preBufferSize: Math.max(0, typeof options.preBufferSize === 'number' ? options.preBufferSize : 2),
        postBufferSize: Math.max(0, typeof options.postBufferSize === 'number' ? options.postBufferSize : 2),
    }
}

class Decoder extends EventEmitter<DecoderEventMap> {
    private static ready: boolean = false;
    private static transferredCanvases: Record<string, OffscreenCanvas> = {};

    private readonly queue: RequestMessage[] = [];
    private readonly key = IdGenerator.generate('Decoder');
    private readonly options: FullOptions;
    private readonly url: string;

    constructor(url: string, options: Options) {
        super();
        this.url = url;
        this.options = mergeWithDefaults(options);
        Worker.addEventListener('message', this.onMessage.bind(this));
    }

    private onMessage(event: MessageEvent<ResponseMessage>) {
        if (event.data.type === 'response:ready') {
            this.onReady();
            return;
        }

        const data = event.data;
        if (data.key !== this.key) {
            return;
        }

        switch (data.type) {
            case "response:error":
                this.dispatch('error', {error: data.error});
                break;
            case "response:loaded":
                this.dispatch('loaded', {width: data.width, height: data.height, count: data.count});
                break;
            case 'response:first-render':
                this.dispatch('first-render', {});
                break;
        }
    }

    private onReady() {
        Decoder.ready = true;
        let message = this.queue.pop();
        while (message) {
            this.send(message);
            message = this.queue.pop();
        }
    }

    private postMessage(message: RequestMessage) {
        if (Decoder.ready) {
            this.send(message);
        } else {
            if (message.type === 'request:dispose') {
                this.queue.splice(0);
            } else {
                
                this.queue.push(message);
            }
        }
    }

    private send(message: RequestMessage) {
        if (message.type === 'request:set-canvas' && message.canvas) {
            const found = Object.entries(Decoder.transferredCanvases).find(entry => entry[1] === message.canvas);
            if (found) {
                message['canvas'] = undefined;
                message['canvasId'] = found[0];
            } else {
                const id = IdGenerator.generate('canvas');
                message['canvasId'] = id;
                Decoder.transferredCanvases[id] = message.canvas;
            }
        }

        const transfers = Object.values(message).filter(this.isTransferrable);

        Worker.postMessage(message, transfers);
    }

    private isTransferrable(value: unknown) {
        if (value instanceof OffscreenCanvas) {
            return true;
        }

        // TODO: All transferable

        return false;
    }

    dispose() {
        this.postMessage({type: 'request:dispose', key: this.key});
        Worker.removeEventListener('message', this.onMessage.bind(this));
    }

    load() {
        this.postMessage({type: 'request:load', key: this.key, url: this.url, options: this.options});
    }

    setRenderer(code: string, canvas: OffscreenCanvas) {
        this.postMessage({type: 'request:set-canvas', key: this.key, code, canvas});
    }

    loadAsync(): Promise<LoadEventData> {
        return new Promise<LoadEventData>((resolve, reject) => {
            const listener = (event: MessageEvent<ResponseMessage>) => {
                const data = event.data;
                if (data.type !== 'response:ready' && data.key !== this.key) {
                    return;
                }
    
                if (data.type === 'response:loaded') {
                    Worker.removeEventListener('message', listener);
                    resolve({width: data.width, height: data.height, count: data.count});
                }

                if (data.type === 'response:error') {
                    Worker.removeEventListener('message', listener);
                    reject(data.error);
                }
            };

            Worker.addEventListener('message', listener);
        });
    }

    request(frame: number) {
        Worker.postMessage({type: 'request:frame', key: this.key, frame});
    }
}

export default Decoder;