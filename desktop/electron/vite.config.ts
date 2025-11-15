import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const rendererRoot = path.resolve(__dirname, 'src/renderer');

export default defineConfig({
  root: rendererRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': rendererRoot
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true
  },
  css: {
    postcss: path.resolve(__dirname, 'postcss.config.cjs')
  }
});

