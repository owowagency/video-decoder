import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {resolve} from 'node:path';
import wasm from 'vite-plugin-wasm';
import wasmPack from './plugins/wasm-pack';
import topLevelAwait from 'vite-plugin-top-level-await';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    wasm(), 
    wasmPack({crate: 'demuxer'}), 
    dts({rollupTypes: true}),
    {
      name: "configure-response-headers",
      configureServer: (server) => {
        server.middlewares.use((req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          if (req.originalUrl && req.originalUrl.endsWith('.mkv')) {
            res.setHeader('Content-Type', 'video/mkv');
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: [{
      find: '@owowagency/video-decoder',
      replacement: resolve(__dirname, 'lib')
    }],
  },
  worker: {
    plugins: () => {
      return  [
        wasm(),
        topLevelAwait(),
      ];
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'lib', 'index.ts'),
      name: 'video-decoder',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      plugins: [wasmPack({crate: 'demuxer'})]
    },
    emptyOutDir: true,
    copyPublicDir: false,
  }
})
