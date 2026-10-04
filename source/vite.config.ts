import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(root, 'src/index.ts'),
      name: 'SpatialHash',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) => {
        if (format === 'es') {
          return 'spatialhash.js';
        }
        if (format === 'cjs') {
          return 'spatialhash.cjs';
        }
        return 'spatialhash.iife.js';
      },
    },
    sourcemap: true,
    minify: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
