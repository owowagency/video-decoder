class Page {
    private readonly frames: ImageBitmap[] = [];
    readonly size: number;
    constructor(readonly from: number, readonly to: number) {
        this.size = to - from;
    }

    get complete(): boolean {
        for (let idx = 0; idx < this.size; idx += 1) {
            if (!this.frames[idx]) {
                return false;
            }
        }

        return true;
    }

    get(idx: number): ImageBitmap | undefined {
        return this.frames[idx]
    }

    set(idx: number, bitmap: ImageBitmap) {
        this.frames[idx] = bitmap;
    }

    free() {
        let frame = this.frames.pop();

        while (frame) {
            frame.close();
            frame = this.frames.pop();
        }
    }

    framesInMemory(): number {
        let count = 0;
        for (const frame of this.frames) {
            if (frame) {
                count += 1;
            }
        }

        return count;
    }
}

export default Page;
