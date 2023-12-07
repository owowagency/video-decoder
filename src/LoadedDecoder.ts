import Decoder from "@owowagency/video-decoder";

interface LoadedDecoder {
    decoder: Decoder,
    width: number,
    height: number,
    count: number,
}

export default LoadedDecoder;