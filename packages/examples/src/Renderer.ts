class Renderer {
    private readonly ctx: WebGL2RenderingContext | WebGLRenderingContext | OffscreenCanvasRenderingContext2D;
    private static vertexShaderSource = `
    attribute vec2 xy;

    varying highp vec2 uv;

    void main(void) {
      gl_Position = vec4(xy, 0.0, 1.0);
      // Map vertex coordinates (-1 to +1) to UV coordinates (0 to 1).
      // UV coordinates are Y-flipped relative to vertex coordinates.
      uv = vec2((1.0 + xy.x) / 2.0, (1.0 - xy.y) / 2.0);
    }
  `;

    private static fragmentShaderSource = `
    varying highp vec2 uv;

    uniform sampler2D texture;

    void main(void) {
      gl_FragColor = texture2D(texture, uv);
    }
  `;
    private currentFrame: number | null = null;
    private vertexShader: WebGLShader | null = null;
    private fragmentShader: WebGLShader | null = null;
    private shaderProgram: WebGLProgram | null = null;
    private vertexBuffer: WebGLBuffer | null = null;
    private texture: WebGLTexture | null = null;

    static getContext(canvas: OffscreenCanvas): WebGL2RenderingContext | WebGLRenderingContext | OffscreenCanvasRenderingContext2D {
        const webglOptions = {
            preserveDrawingBuffer: false,
            antialias: false,
            depth: false,
            powerPreference: 'high-performance',
        };
        const gl2 = canvas.getContext('webgl2', webglOptions);

        if (gl2) {
            return gl2;
        }

        const gl = canvas.getContext('webgl', webglOptions);

        if (gl) {
            return gl;
        }

        const options2d = {
            antialias: false,
            alpha: false,
            willReadFrequently: false,
        }
        const ctx = canvas.getContext('2d', options2d);

        if (ctx) {
            return ctx;
        }

        throw new Error('Could not get canvas context, tried webgl2, webgl and 2d');
    }

    static getError(ctx: WebGL2RenderingContext | WebGLRenderingContext) {
        const error = ctx.getError();
        switch (error) {
            case ctx.NO_ERROR: return `[${error}] No WebGL Error`;
            case ctx.INVALID_ENUM: return `[${error}] Invalid Enum`;
            case ctx.INVALID_VALUE: return `[${error}] Invalid Value`;
            case ctx.INVALID_OPERATION: return `[${error}] Invalid Operation`;
            case ctx.INVALID_FRAMEBUFFER_OPERATION: return `[${error}] Invalid Framebuffer Operation`;
            case ctx.OUT_OF_MEMORY: return `[${error}] Out of Memory`;
            case ctx.CONTEXT_LOST_WEBGL: return `[${error}] Context Lost`;
            default: return `[${error}] Unknown WebGL Error`;
        }
    }

    static error(ctx: WebGL2RenderingContext | WebGLRenderingContext, description: string): Error {
        return new Error(`${description} ${Renderer.getError(ctx)}`);
    }

    constructor(canvas: OffscreenCanvas) {
        const gl = Renderer.getContext(canvas);

        if (!(gl instanceof OffscreenCanvasRenderingContext2D)) {
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            if (!vertexShader) {
                throw Renderer.error(gl, 'Unable to create vertex shader');
            }

            this.vertexShader = vertexShader;
            gl.shaderSource(vertexShader, Renderer.vertexShaderSource);
            gl.compileShader(vertexShader);
            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                throw gl.getShaderInfoLog(vertexShader);
            }

            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            if (!fragmentShader) {
                throw Renderer.error(gl, 'Unable to create fragment shader');
            }

            this.fragmentShader = fragmentShader;
            gl.shaderSource(fragmentShader, Renderer.fragmentShaderSource);
            gl.compileShader(fragmentShader);
            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                throw gl.getShaderInfoLog(fragmentShader);
            }

            const shaderProgram = gl.createProgram();
            if (!shaderProgram) {
                throw Renderer.error(gl, 'Unable to create program');
            }

            this.shaderProgram = shaderProgram;
            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);
            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                throw gl.getProgramInfoLog(shaderProgram);
            }
            gl.useProgram(shaderProgram);

            const vertexBuffer = gl.createBuffer();

            this.vertexBuffer = vertexBuffer;
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1.0, -1.0,
                -1.0, +1.0,
                +1.0, +1.0,
                +1.0, -1.0
            ]), gl.STATIC_DRAW);

            const xyLocation = gl.getAttribLocation(shaderProgram, "xy");
            gl.vertexAttribPointer(xyLocation, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(xyLocation);

            const texture = gl.createTexture();

            this.texture = texture;
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        this.ctx = gl;
    }

    draw(frame: number, image: ImageBitmap) {
        if (this.currentFrame === frame) {
            return;
        }
        this.currentFrame = frame;
        if (this.ctx instanceof OffscreenCanvasRenderingContext2D) {
            this.ctx.drawImage(image, 0, 0);
        } else {
            const gl = this.ctx;
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        }
    }

    close() {
        const ctx = this.ctx;

        if (ctx instanceof OffscreenCanvasRenderingContext2D) {
            return;
        }

        ctx.bindTexture(ctx.TEXTURE_2D, null);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        if (this.shaderProgram && this.vertexShader) {
            ctx.detachShader(this.shaderProgram, this.vertexShader);
        }
        if (this.shaderProgram && this.fragmentShader) {
            ctx.detachShader(this.shaderProgram, this.fragmentShader);
        }
        ctx.deleteProgram(this.shaderProgram);
        ctx.deleteShader(this.vertexShader);
        ctx.deleteShader(this.fragmentShader);
        ctx.deleteBuffer(this.vertexBuffer);
        ctx.deleteTexture(this.texture);
    }
}

export default Renderer;