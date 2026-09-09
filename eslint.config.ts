import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/node_modules', 'frontend/dist'],
  },
  js.configs.recommended,

  // Backend — Node / ESM / TypeScript
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['backend/**/*.ts'],
  })),
  {
    files: ['backend/**/*.{js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['backend/spec/**/*.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },

  // Frontend — Vite + React + TypeScript
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['frontend/**/*.{ts,tsx}'],
  })),
  {
    files: ['frontend/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },

  prettier
);
