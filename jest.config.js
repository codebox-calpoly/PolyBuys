module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/utils/**/*.ts', '**/types/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/_generated/'],
  moduleNameMapper: {
    '^@polybuys/shared$': '<rootDir>/packages/shared',
  },
  // Explicitly configure transforms
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
    '^.+\\.jsx?$': ['babel-jest'],
  },
  // Transform ES module packages from node_modules with babel
  transformIgnorePatterns: ['node_modules/(?!(convex-test|convex)/)'],
};
