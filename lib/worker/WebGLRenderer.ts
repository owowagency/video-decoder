class WebGLRenderer {
    private readonly canvas: OffscreenCanvas;
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

    constructor(canvas: OffscreenCanvas) {
        this.canvas = canvas;
        const gl = WebGLRenderer.getContext(canvas);

        if (!(gl instanceof OffscreenCanvasRenderingContext2D)) {
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            if (!vertexShader) {
                throw new Error('Unable to create vertex shader');
            }
            gl.shaderSource(vertexShader, WebGLRenderer.vertexShaderSource);
            gl.compileShader(vertexShader);
            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                throw gl.getShaderInfoLog(vertexShader);
            }

            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            if (!fragmentShader) {
                throw new Error('Unable to create fragment shader');
            }

            gl.shaderSource(fragmentShader, WebGLRenderer.fragmentShaderSource);
            gl.compileShader(fragmentShader);
            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                throw gl.getShaderInfoLog(fragmentShader);
            }

            const shaderProgram = gl.createProgram();
            if (!shaderProgram) {
                throw new Error('Unable to create program');
            }

            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);
            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                throw gl.getProgramInfoLog(shaderProgram);
            }
            gl.useProgram(shaderProgram);

            const vertexBuffer = gl.createBuffer();
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
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        this.ctx = gl;
    }

    draw(frame: VideoFrame | ImageBitmap) {
        if (this.ctx instanceof OffscreenCanvasRenderingContext2D) {
            this.ctx.drawImage(frame, 0, 0);
        } else {
            const gl = this.ctx;
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        }
    }

    transferToImageBitmap(): ImageBitmap {
        return this.canvas.transferToImageBitmap();
    }
}

export default WebGLRenderer;