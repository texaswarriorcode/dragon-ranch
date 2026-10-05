import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages project site: https://texaswarriorcode.github.io/dragon-ranch/
  // Dev server keeps serving at http://localhost:5173/
  base: command === 'build' ? '/dragon-ranch/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
}));
