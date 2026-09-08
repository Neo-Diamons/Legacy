import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules',
      'frontend/js/babel.min.js',
      'frontend/js/react.production.min.js',
      'frontend/js/react-dom.production.min.js',
      'frontend/js/react-bootstrap.js',
    ],
  },
  js.configs.recommended,

  // Backend — Node / ESM
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['backend/spec/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },

  // Frontend — browser globals, in-browser JSX
  {
    files: ['frontend/js/app.js'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        React: 'readonly',
        ReactDOM: 'readonly',
        ReactBootstrap: 'readonly',
      },
    },
    settings: { react: { version: '18' } },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
    },
  },

  prettier,
];
