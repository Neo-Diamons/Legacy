import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@db$/, replacement: src('db/index.ts') },
      { find: /^@db\/(.*)\.js$/, replacement: src('db/$1') },
      { find: /^@model\/(.*)\.js$/, replacement: src('model/$1') },
      { find: /^@service\/(.*)\.js$/, replacement: src('service/$1') },
      { find: /^@controller\/(.*)\.js$/, replacement: src('controller/$1') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['spec/**/*.spec.ts'],
  },
});
