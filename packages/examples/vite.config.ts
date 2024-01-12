import { defineConfig } from 'vite'
import {resolve} from 'node:path';
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
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
    alias: {
      // '@owowagency/video-decoder': resolve('..', 'video-decoder', 'src', 'index.ts'), 
      // This is not great, HMR reloads the entire module & makes debugging harder
      '@owowagency/video-decoder': resolve('..', 'video-decoder', 'dist', 'index.js'), 
    },
    preserveSymlinks: true
  }
})
