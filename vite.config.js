import { defineConfig } from 'vite';

export default defineConfig({
  base: '/aurora-runes/',
  build: {
    chunkSizeWarningLimit: 1200,
  },
});