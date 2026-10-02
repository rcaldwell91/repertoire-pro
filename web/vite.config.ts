import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Built into ../app, which GitHub Pages serves at
   rcaldwell91.github.io/repertoire-pro/app/. Relative paths, so the same
   build works there and from any local server. */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../app', emptyOutDir: true, sourcemap: false },
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], environment: 'node' },
});
