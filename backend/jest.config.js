module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/__tests__/**', '!**/_generated/**'],
  moduleNameMapper: {
    '^@polybuys/shared$': '<rootDir>/../packages/shared',
    '^./_generated/server$': '<rootDir>/convex/__mocks__/server.js',
  },
  testPathIgnorePatterns: [],
  // Use ts-jest to transform TypeScript files
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          isolatedModules: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
