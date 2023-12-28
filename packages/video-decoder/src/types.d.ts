declare module '@crate/demuxer' {
   /**
    * @param {ArrayBuffer} buffer
    * @param {string} format
    * @returns {Demuxer}
    */
    export function load(buffer: ArrayBuffer, format: string): Demuxer;

    export class Demuxer {
        free(): void;

        /**
        * @returns {number}
        */
        codedWidth(): number;

        /**
        * @returns {number}
        */
        codedHeight(): number;

        /**
        * @returns {string | undefined}
        */
        codec(): string | undefined;

        /**
        * @returns {number | undefined}
        */
        displayWidth(): number | undefined;

        /**
        * @returns {number | undefined}
        */
        displayHeight(): number | undefined;

        /**
        * @returns {number}
        */
        duration(): number;

        /**
        * @returns {number}
        */
        frameCount(): number;

        /**
        * @param {number} timestamp
        * @returns {number | undefined}
        */
        timestampToFrame(timestamp: number): number | undefined;

        /**
        * @param {number} from
        * @param {number} to
        * @param {VideoDecoder} decoder
        * @returns {number}
        */
        decode(from: number, to: number, decoder: VideoDecoder): number;

        /**
        * @param {number} frame
        * @param {VideoDecoder} decoder
        * @returns {number}
        */
        seek(frame: number, decoder: VideoDecoder): number;
    }
}

