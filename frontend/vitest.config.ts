import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['vitest/**/*.test.tsx'],
    setupFiles: ['./vitest/setup.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'html', 'lcov', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.tsx'],
      exclude: ['src/main.tsx'],
    },
  },
});
