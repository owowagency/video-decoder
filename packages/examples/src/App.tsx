import {Options} from '@owowagency/video-decoder';
import Scroller from './Scroller';
import { useEffect, useMemo, useState } from 'react';

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

interface Route {
  url: URL,
  segments: string[]
}

const getRoute = (): Route => {
  const url = new URL(window.location.href);
  const segments = url.pathname.replace(/^\//, '').split('/');
  return {
    url,
    segments,
  };
}

const useRoute = (): Route => {
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const listener = () => {
      setRoute(getRoute());
    };
    window.addEventListener('locationchange', listener);

    return () => {
      window.removeEventListener('locationchange', listener);
    };
  }, [setRoute]);

  return route;
}

const getAssetFromRoute = (route: Route): Asset => {
  let size = '1920x1080';
  let duration = '2s';
  let fps = '60fps';
  let codec = 'vp9';
  let container = 'webm';

  const fallback = `${duration}_${fps}_${size}_${codec}_${container}`;

  let idx = 1;

  for (const segment of route.segments) {
    if (segment === 'default' || segment === '') {
      idx += 1;
      continue;
    }

    switch (idx) {
      case 1: size = segment; break;
      case 2: duration = segment; break;
      case 3: fps = segment; break;
      case 4: codec = segment; break;
      case 5: container = segment; break;
    }

    idx += 1;
  }

  const key = `${duration}_${fps}_${size}_${codec}_${container}`;
  const asset = configs[key];

  if (!asset) {
    console.warn('Did not find configuration', {size, duration, fps, codec, container});
    return configs[fallback];
  }

  return asset;
}

const useAsset = (): Asset => {
  const route = useRoute();
  return useMemo(() => getAssetFromRoute(route), [route]);
}

function App() {
  const asset = useAsset();
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
