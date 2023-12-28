class Logger {
    constructor(readonly tag: string) {

    }
    
    warn(message?: unknown, ...optionalParams: unknown[]) {
        return console.warn(`[${this.tag}]`, message, ...optionalParams);
    }

    log(message?: unknown, ...optionalParams: unknown[]) {
        return console.log(`[${this.tag}]`, message, ...optionalParams);
    }

    time(label?: string) {
        return console.time(`[${this.tag}] ${label}`);
    }

    timeEnd(label?: string) {
        return console.timeEnd(`[${this.tag}] ${label}`);
    }
}

export default Logger;