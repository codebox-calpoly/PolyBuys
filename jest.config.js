module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/utils/**/*.ts', '**/types/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/_generated/'],
  moduleNameMapper: {
    '^@polybuys/shared$': '<rootDir>/packages/shared',
  },
};
