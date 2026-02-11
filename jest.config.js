module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/utils/**/*.ts', '**/types/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/_generated/'],
  moduleNameMapper: {
    '^@polybuys/shared$': '<rootDir>/packages/shared',
  },
  testPathIgnorePatterns: ['/node_modules/'],

  transform: {
    '^.+\\.(t|j)sx?$': 'babel-jest',
  },

  // ✅ Transform ESM deps that ship untranspiled in node_modules
  transformIgnorePatterns: ['/node_modules/(?!convex-test/)'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
