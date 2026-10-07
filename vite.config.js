import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages project site: https://texaswarriorcode.github.io/dragon-ranch/
  // Dev server keeps serving at http://localhost:5173/
  // `vite preview` serves the production build, so it needs the Pages base too
  base: command === 'build' || isPreview ? '/dragon-ranch/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
}));
