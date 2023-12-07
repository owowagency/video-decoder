# @owowagency/video-decoder

## Usage

```ts
import Decoder from '@owowagency/video-decoder'
import VideoUrl from './assets/video.webm';

// Transfer control offscreen, so it can be sent to a web worker
const canvas = document.querySelector('#canvas').transferControlToOffscreen();
const decoder = new Decoder(VideoUrl, {
    codec: 'vp09.00.61.12',
    pageSize: 10,
    preBufferSize: 2,
    postBufferSize: 2,
})

// Sends the renderer code & offscreen canvas to a web worker
decoder.setRenderer(btoa(`
class Renderer {
    constructor(canvas) {
        this.ctx = canvas.getContext('2d');
    }

    draw(frame, image) {
        this.ctx.drawImage(image, 0, 0);
    }
}
`), canvas);

// Load & prepare the video file for decoding
decoder.load();
// Decode the 10th frame, the frame will be passed to the `draw()` as an `ImageBitmap` method of the renderer
decoder.request(10);
// Make sure to dispose the decoder once done, this disposes all buffered frames etc.
decoder.dispose();
```