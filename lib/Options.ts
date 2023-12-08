export interface Options {
    pageSize?: number,
    preBufferSize?: number,
    postBufferSize?: number,
}

type Full<T> = {
    [P in keyof T]-?: T[P];
}

export type FullOptions = Full<Options>;
