import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: [
      { find: /^@db$/, replacement: src('db/index.ts') },
      { find: /^@db\/(.*)\.js$/, replacement: src('db/$1') },
      { find: /^@http\/(.*)\.js$/, replacement: src('http/$1') },
      { find: /^@model\/(.*)\.js$/, replacement: src('model/$1') },
      { find: /^@schemas\/(.*)\.js$/, replacement: src('schemas/$1') },
      { find: /^@service\/(.*)\.js$/, replacement: src('service/$1') },
      { find: /^@controller\/(.*)\.js$/, replacement: src('controller/$1') },
      { find: /^@utils\/(.*)\.js$/, replacement: src('utils/$1') },
      { find: /^@ws\/(.*)\.js$/, replacement: src('ws/$1') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      SQLITE_DB_LOCATION: './todo.test.db',
      ...loadEnv(mode, repoRoot, ''),
      ...loadEnv(mode, root, ''),
    },
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'html', 'lcov', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/db/**'],
    },
  },
}));
