import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: ['es2022', 'safari16.4'],
    sourcemap: true,
  },
});
