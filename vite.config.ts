import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {resolve} from 'node:path';
import wasm from 'vite-plugin-wasm';
import wasmPack from './plugins/wasm-pack';
import resolveBase64 from './plugins/resolve-base64';
import topLevelAwait from 'vite-plugin-top-level-await';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    wasm(), 
    wasmPack({crate: 'demuxer'}), 
    resolveBase64()
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
