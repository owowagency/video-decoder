import {Options} from '@owowagency/video-decoder';
import Scroller from './Scroller';

interface Asset {
  url: string,
  name: string,
  options: Options,
  frameHeight: number,
  frameWidth: number,
  frameCount: number,
  thumbnail?: string,
  pxPerFrame: number,
  fps: number,
}

function extractConfig(url: string): Asset {
  const pattern = /^.+\/video_(?<duration>\d+)s_(?<fps>\d+)fps_(?<width>\d+)x(?<height>\d+)_(?<codec>.+)\.(?<ext>[^?]+)\??(.*)$/;
  const match = url.match(pattern);
  if (match && match.groups) {
    const duration = parseInt(match.groups['duration']);
    const fps = parseInt(match.groups['fps']);
    const frameCount = fps * duration;
    const width = parseInt(match.groups['width']);
    const height = parseInt(match.groups['height']);
    const codecId = match.groups['codec'];
    const ext = match.groups['ext'];
    const codec = (function () {
      switch (codecId) {
        case 'av1': return 'av01.0.00M.08';
        case 'vp9': return 'vp09.01.61.12';
        case 'vp8': return 'vp8';
        default: throw new Error(`Unknown codec: ${codecId}`);
      }
    })();

    return {
      fps: 1000 / fps,
      url,
      name: `${duration}s_${fps}fps_${width}x${height}_${codecId}_${ext}`,
      options: {
        codec,
      },
      frameCount: frameCount,
      frameWidth: width,
      frameHeight: height,
      pxPerFrame: 50,
    }
  }

  throw new Error('File name does not match pattern');
}

function assets(): Record<string, Asset> {
  const x = import.meta.glob('./assets/videos/*', {eager: true, as: 'url'});

  return Object.values(x).map(extractConfig).reduce((acc, asset) => ({...acc, [asset.name]: asset}), {});
}

const configs: Record<string, Asset> = assets();

const fallback = '2s_30fps_1280x720_av1_mp4';

const asset = configs[new URL(window.location.href).searchParams.get('asset') || fallback] || configs[fallback];

console.log('asset', asset);

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
