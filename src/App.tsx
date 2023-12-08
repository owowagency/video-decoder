import {Options} from '@owowagency/video-decoder';
import VideoUrl from './assets/bunny.webm?url';
import ThumbnailUrl from './assets/bunny.webp?url';
import Scroller from './Scroller';

interface Asset {
  url: string,
  options: Options,
  frameHeight: number,
  frameWidth: number,
  frameCount: number,
  thumbnail: string,
  pxPerFrame: number,
  fps: number,
}

const configs: Record<string, Asset> = {
  bunny: {
    url: VideoUrl,
    options: {},
    frameHeight: 1080,
    frameWidth: 1920,
    frameCount: 3600,
    thumbnail: ThumbnailUrl,
    pxPerFrame: 50,
    fps: 1000 / 30,
  },
};

const asset = configs[new URL(window.location.href).searchParams.get('asset') || 'bunny'] || configs.bunny;

function App() {
  return (
    <>
      <Scroller 
        src={asset.url} 
        options={asset.options}
        frameHeight={asset.frameHeight}
        frameWidth={asset.frameWidth}
        frameCount={asset.frameCount}
        thumbnail={asset.thumbnail}
        pxPerFrame={asset.pxPerFrame}
        fps={asset.fps}
        />
    </>
  )
}

export default App
