module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/utils/**/*.ts', '**/types/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/_generated/'],
  moduleNameMapper: {
    '^@polybuys/shared$': '<rootDir>/packages/shared',
  },
  testPathIgnorePatterns: [],
  // Use ts-jest to transform TypeScript files
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Tell ts-jest to parse JSX/TypeScript syntax
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
};
