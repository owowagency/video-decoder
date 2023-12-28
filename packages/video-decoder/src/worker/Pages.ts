import Page from "./Page";

class Pages {
    private readonly pages: Page[] = [];
    readonly size: number;

    constructor(
        count: number, 
        private readonly pageSize: number,
    ) {
        for (let idx = 0; idx < count; idx += pageSize) {
            const to = Math.min(count, idx + pageSize);
            this.pages.push(new Page(idx, to));
        }
        this.size = this.pages.length;
    }

    getPageNumber(frame: number) {
        return Math.floor(frame / this.pageSize);
    }

    getFrame(frame: number): ImageBitmap | undefined {
        const page = this.pages[this.getPageNumber(frame)];

        if (page) {
            return page.get(frame - page.from);
        }

        return undefined;
    }

    getPage(page: number): Page | undefined {
        return this.pages[page];
    }

    free(page: number) {
        this.pages[page]?.free();
    }

    set(frame: number, bitmap: ImageBitmap) {
        const page = this.pages[this.getPageNumber(frame)];

        if (page) {
            return page.set(frame - page.from, bitmap);
        }

        return undefined;
    }

    freeAll() {
        for (const page of this.pages) {
            page.free();
        }
    }

    framesInMemory() {
        let count = 0;
        for (const page of this.pages) {
            count += page.framesInMemory();
        }

        return count;
    }
}

export default Pages;