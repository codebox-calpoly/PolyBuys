module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'backend/convex/**/*.ts',
    'packages/shared/**/*.ts',
    '!**/__tests__/**',
    '!**/_generated/**',
    '!**/node_modules/**',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/_generated/', '/__tests__/'],
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
