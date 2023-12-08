# @owowagency/video-decoder

## Usage

Renderer.ts

```ts
class Renderer {
    private readonly ctx: OffscreenCanvasRenderingContext2D;
    constructor(canvas: OffscreenCanvas) {
        this.ctx = canvas.getContext('2d');
    }

    draw(frame: number, image: ImageBitmap) {
        this.ctx.drawImage(image, 0, 0);
    }
}

export default Renderer;
```

main.ts

```ts
import Decoder from '@owowagency/video-decoder'
import VideoUrl from './assets/video.webm';
import Renderer from './Renderer.ts?url';

// Transfer control offscreen, so it can be sent to a web worker
const canvas = document.querySelector('#canvas').transferControlToOffscreen();
const decoder = new Decoder(VideoUrl, {
    pageSize: 10,
    preBufferSize: 2,
    postBufferSize: 2,
})

// Sends the renderer script url & offscreen canvas to a web worker
decoder.setRenderer(renderer, canvas);
// Load & prepare the video file for decoding
decoder.load();
// Decode the 10th frame, the frame will be passed to the `draw()` as an `ImageBitmap` method of the renderer
decoder.request(10);
// Make sure to dispose the decoder once done, this disposes all buffered frames etc.
decoder.dispose();
```