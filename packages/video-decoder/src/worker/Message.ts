import { FullOptions } from "../Options";

export interface RequestLoadMessage {
    type: 'request:load',
    key: string,
    url: string,
    options: FullOptions,
}

export interface RequestDisposeMessage {
    type: 'request:dispose',
    key: string,
}

export interface RequestFrameMessage {
    type: 'request:frame',
    key: string,
    frame: number,
}

export interface RequestSetCanvasMessage {
    type: 'request:set-canvas',
    key: string,
    code: string,
    canvas?: OffscreenCanvas,
    canvasId?: string,
}

export type RequestMessage = RequestLoadMessage | RequestDisposeMessage | RequestFrameMessage | RequestSetCanvasMessage;

export interface ResponseLoadedMessage {
    type: 'response:loaded',
    key: string,
    count: number,
    width: number,
    height: number,
}

export interface ResponseErrorMessage {
    type: 'response:error',
    key: string,
    error?: string,
}

export interface ResponseFirstRenderMessage {
    type: 'response:first-render',
    key: string,
}

export interface ResponseReadyMessage {
    type: 'response:ready',
}

export type ResponseMessage = ResponseErrorMessage | ResponseLoadedMessage | ResponseReadyMessage | ResponseFirstRenderMessage;

export type Message = RequestMessage | ResponseMessage;