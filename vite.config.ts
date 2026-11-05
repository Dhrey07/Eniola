import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl({ importKeywords: ['#import'], minify: false })],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
