import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

process.env.TZ = 'UTC';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // react-bootstrap transitions read CSS durations jsdom doesn't compute (NaN); harmless, only noise.
    execArgv: ['--disable-warning=TimeoutNaNWarning'],
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/types.ts', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
    },
  },
});
