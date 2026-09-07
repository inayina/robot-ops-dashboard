import { defineConfig } from 'vite';

export default defineConfig({
  base: '/frontend/',
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
});
