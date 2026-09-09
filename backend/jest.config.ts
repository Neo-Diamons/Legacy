import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@db$': '<rootDir>/src/db/index.ts',
    '^@db/(.*)\\.js$': '<rootDir>/src/db/$1',
    '^@model/(.*)\\.js$': '<rootDir>/src/model/$1',
    '^@service/(.*)\\.js$': '<rootDir>/src/service/$1',
    '^@controller/(.*)\\.js$': '<rootDir>/src/controller/$1',
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
