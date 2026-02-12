module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/__tests__/**', '!**/_generated/**'],

  moduleNameMapper: {
    '^@polybuys/shared$': '<rootDir>/../packages/shared',
    '^.+/_generated/server$': '<rootDir>/convex/__mocks__/server.js',
  },

  testPathIgnorePatterns: [],

  // ⭐ Treat both TS and JS as ESM
  extensionsToTreatAsEsm: ['.ts', '.js'],

  // ⭐ Allow convex-test to be transformed
  transformIgnorePatterns: ['node_modules/(?!convex-test)'],

  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          isolatedModules: true,
          types: ['jest', 'node'],
        },
        useESM: true,
      },
    ],
  },
};
