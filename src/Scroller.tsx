import { HTMLProps, RefObject, useEffect, useRef, useState } from "react";
import Decoder, { Options } from '@owowagency/video-decoder';
import LoadedDecoder from "./LoadedDecoder";
import Renderer from "./Renderer?url";

interface Props {
    src: string;
    options: Options,
    frameHeight: number,
    frameWidth: number,
    frameCount: number,
    thumbnail?: string,
    pxPerFrame: number,
    fps: number,
}

const useOffscreenCanvas = (canvas: RefObject<HTMLCanvasElement>): OffscreenCanvas | undefined => {
    const [offscreen, setOffscreen] = useState<OffscreenCanvas>();

    useEffect(() => {
        setOffscreen((c) => {
            if (c instanceof OffscreenCanvas) {
                return c;
            }

            if (canvas.current) {
                return canvas.current.transferControlToOffscreen();
            }
            
            return undefined;
        });
    }, [canvas]);

    return offscreen;
}

const useDecoder = (url: string, options: Options, canvas: RefObject<HTMLCanvasElement>): LoadedDecoder | undefined => {
    const [decoder, setDecoder] = useState<LoadedDecoder>();
    const offscreen = useOffscreenCanvas(canvas);
    useEffect(() => {
      if (!offscreen) {
        return;
      }

      const current = new Decoder(`${window.location.origin}${url}`, options);
      current.on('loaded', (data) => {
        current.setRenderer(Renderer, offscreen);
        setDecoder({
          decoder: current,
          width: data.width,
          height: data.height,
          count: data.count,
        });
      });
      current.on('error', (data) => {
        console.error(data.error);
      });
      current.load();
  
      return () => {
        current.dispose();
      }
    }, [url, options, offscreen]);
  
    return decoder;
  }

const useScroller = (container: RefObject<HTMLElement>, canvas: RefObject<HTMLCanvasElement>, decoder?: LoadedDecoder): boolean => {
    const [rendered, setRendered] = useState(false);
    useEffect(() => {
        const currentContainer = container.current;
        const currentCanvas = canvas.current;
        if (!(currentContainer && currentCanvas && decoder)) {
            return;
        }

        let frame = 0;
        const onScroll = () => {
            const end = currentContainer.clientHeight + currentContainer.offsetTop - window.innerHeight;
            const scroll = Math.min(end, Math.max(0, window.scrollY - currentContainer.offsetTop));
            const progress = scroll / end;
            frame = Math.min(decoder.count, Math.max(0, Math.ceil(progress * decoder.count)));
        };

        const onFirstFrame = () => {
            setRendered(true);
        }

        decoder.decoder.on('first-render', onFirstFrame);

        onScroll();
        document.addEventListener('scroll', onScroll, {passive: true});
        let id = -1;
        let last = -1;
        function draw() {
            if (last !== frame) {
                decoder?.decoder?.request(frame);
                last = frame;
            }

            id = requestAnimationFrame(draw);
        }

        id = requestAnimationFrame(draw);

        return () => {
            decoder.decoder.off('first-render', onFirstFrame);
            document.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(id);
        }
    }, [container, canvas, decoder]);

    return rendered;
}

interface PlaceholderProps {
    src: string,
    width: number,
    height: number,
}

const Placeholder = ({ src, width, height }: PlaceholderProps) => {
    return (<img
        style={{
            height: '100%',
            width: 'auto',
            position: 'absolute',
            transform: 'translateX(-50%)',
            left: '50%',
            top: 0,
        }}
        src={src}
        width={width}
        height={height}
    />)
}

const useDebug = () => {
    const search = new URLSearchParams(window.location.search);
    return typeof search.get('debug') === 'string';
}

const Buttons = ({px, fps}: {px: number, fps: number}) => {
    const id = useRef(-1);

    const onTouchStart = (direction: 'up' | 'down') => {
        clearInterval(id.current);

        id.current = setInterval(() => {
            switch (direction) {
                case 'up':
                    window.scrollBy({top: -(px * 1.5)});
                break;
                case 'down':
                    window.scrollBy({top: (px * 1.5)});
                break;
            }
        }, fps) as unknown as number;
    }

    const onCancel = () => {
        clearInterval(id.current);
    }

    return (<div>
        <button onMouseDown={() => onTouchStart('up')} onMouseUp={onCancel} onMouseOut={onCancel}>
            up
        </button>

        <button onMouseDown={() => onTouchStart('down')} onMouseUp={onCancel} onMouseOut={onCancel}>
            down
        </button>
    </div>)
}

const Scroller = ({ src, options, thumbnail, pxPerFrame, fps, frameCount, frameHeight, frameWidth, ...rest }: HTMLProps<HTMLCanvasElement> & Props) => {
    const debug = useDebug();
    const canvas = useRef<HTMLCanvasElement>(null);
    const container = useRef<HTMLDivElement>(null);
    const decoder = useDecoder(src, options, canvas);
    const rendered = useScroller(container, canvas, decoder);

    return (
        <>
        <div style={{ position: 'relative', height: `${frameCount * pxPerFrame}px` }} ref={container}>
            <div style={{ position: 'sticky', top: 0, display: 'flex', alignItems: 'center', height: '100vh', overflowX: 'hidden', width: '100%' }}>
                <canvas {...rest}
                    ref={canvas}
                    width={frameWidth}
                    height={frameHeight}
                    style={{
                        height: '100%',
                        width: 'auto',
                        position: 'absolute',
                        transform: 'translateX(-50%)',
                        left: '50%',
                        top: 0,
                    }}
                />

                {!rendered && thumbnail && <Placeholder src={thumbnail} width={frameWidth} height={frameHeight} />}

                {debug && <div style={{position: 'absolute', padding: '1rem', top: 0, fontWeight: 'bold', color: '#fff', textShadow: 'rgb(0, 0, 0) 1px 1px 2px'}}>
                    {Intl.NumberFormat('nl-NL').format(frameCount)} frames @ {frameWidth}x{frameHeight}
                </div>}
            </div>
        </div>

        {debug && <div style={{position: 'fixed', padding: '1rem', bottom: 0, right: 0,}}>
            <Buttons fps={fps} px={pxPerFrame} />
        </div>}
        </>
    )
};

export default Scroller;