export interface PublicEventEmitter<Map> {
    on<K extends keyof Map>(type: K, callback: (event: Map[K]) => void): void;

    off<K extends keyof Map>(type: K, callback: (event: Map[K]) => void): void;
}

type Callback = (data: unknown) => void;

class EventEmitter<Map> implements PublicEventEmitter<Map> {
    private readonly map: Partial<Record<keyof Map, Callback[]>> = {};

    dispatch<K extends keyof Map>(type: K, data: Map[K]) {
        const listeners = this.map[type];

        if (Array.isArray(listeners)) {
            for (const listener of listeners) {
                listener(data as unknown);
            }
        }
    }

    on<K extends keyof Map>(type: K, callback: (event: Map[K]) => void) {
        const listeners: Callback[] = this.map[type] = [];
        listeners.push(callback as Callback);
    }

    off<K extends keyof Map>(type: K, callback: (event: Map[K]) => void) {
        const listeners = this.map[type];
        const toRemove: number[] = [];
        if (Array.isArray(listeners)) {
            let idx = 0;
            for (const listener of listeners) {
                if (listener === callback) {
                    toRemove.push(idx);
                }

                idx += 1;
            }

            for (const idx of toRemove) {
                listeners.splice(idx, 1);
            }
        }

        
    }

    close() {
        for (const key of Object.keys(this.map)) {
            this.map[key as keyof Map] = [];
        }
    }
}

export default EventEmitter;