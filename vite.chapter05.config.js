// Dedicated Chapter 5 config: the MINIATURE GALLERY slice builds and serves
// without touching the shared game entry (vite.config.js stays untouched).
//
//   dev:   npx vite --config vite.chapter05.config.js   → http://localhost:5185/museum.html
//   build: npx vite build --config vite.chapter05.config.js → dist-chapter05/

import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    port: 5185,
    strictPort: true,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist-chapter05',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(rootDir, 'museum.html'),
    },
  },
});
