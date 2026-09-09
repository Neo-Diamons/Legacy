import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@db$': '<rootDir>/db/index.ts',
    '^@db/(.*)\\.js$': '<rootDir>/db/$1',
    '^@model/(.*)\\.js$': '<rootDir>/model/$1',
    '^@service/(.*)\\.js$': '<rootDir>/service/$1',
    '^@controller/(.*)\\.js$': '<rootDir>/controller/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: { verbatimModuleSyntax: false },
      },
    ],
  },
};

export default config;
