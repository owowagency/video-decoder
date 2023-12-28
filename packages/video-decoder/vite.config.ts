import { defineConfig } from 'vite'
import {resolve} from 'node:path';
import wasm from 'vite-plugin-wasm';
import wasmPack from './plugins/wasm-pack';
import topLevelAwait from 'vite-plugin-top-level-await';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  worker: {
    format: 'es',
    plugins: () => {
      return  [
        wasm(),
        topLevelAwait(),
      ];
    }
  },
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src', 'index.ts'),
      name: 'video-decoder',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      plugins: [
        wasm(), 
        wasmPack({crate: 'demuxer'}), 
        dts({
          rollupTypes: true, 
          tsconfigPath: './tsconfig.json'
        }),
      ]
    },
    emptyOutDir: false,
    copyPublicDir: false,
  }
})
