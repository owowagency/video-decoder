import {Options} from '@owowagency/video-decoder';
import VideoUrl from './assets/bunny.webm?url';
import ThumbnailUrl from './assets/bunny.webp?url';
import Scroller from './Scroller';

import SampleVideoVp9Mp4Url from './assets/sample_vp9.mp4?url';
import SampleVideoAv1Mp4Url from './assets/sample_av1.mp4?url';
import SampleVideoVp9WebmUrl from './assets/sample_vp9.webm?url';
import SampleVideoVp8WebmUrl from './assets/sample_vp8.webm?url';
import SampleThumbnailUrl from './assets/sample.webp?url';

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
    options: {
      codec: 'vp09.00.61.12',
    },
    frameHeight: 1080,
    frameWidth: 1920,
    frameCount: 3600,
    thumbnail: ThumbnailUrl,
    pxPerFrame: 50,
    fps: 1000 / 30,
  },
  'sample-vp9-webm': {
    url: SampleVideoVp9WebmUrl,
    options: {
      codec: 'vp09.00.61.12',
    },
    frameHeight: 540,
    frameWidth: 960,
    frameCount: 375,
    thumbnail: SampleThumbnailUrl,
    pxPerFrame: 100,
    fps: 1000 / 60,
  },
  'sample-vp8-webm': {
    url: SampleVideoVp8WebmUrl,
    options: {
      codec: 'vp8',
    },
    frameHeight: 540,
    frameWidth: 960,
    frameCount: 375,
    thumbnail: SampleThumbnailUrl,
    pxPerFrame: 100,
    fps: 1000 / 60,
  },
  'sample-vp9-mp4': {
    url: SampleVideoVp9Mp4Url,
    options: {
      codec: 'vp09.00.61.12',
    },
    frameHeight: 540,
    frameWidth: 960,
    frameCount: 375,
    thumbnail: SampleThumbnailUrl,
    pxPerFrame: 100,
    fps: 1000 / 60,
  },
  'sample-av1-mp4': {
    url: SampleVideoAv1Mp4Url,
    options: {
      codec: 'av01.0.00M.08',
    },
    frameHeight: 540,
    frameWidth: 960,
    frameCount: 375,
    thumbnail: SampleThumbnailUrl,
    pxPerFrame: 100,
    fps: 1000 / 60,
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
