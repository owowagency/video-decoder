interface Renderer {
    draw(frame: number, image: CanvasImageSource): void;
    close(): void;
}

export default Renderer;