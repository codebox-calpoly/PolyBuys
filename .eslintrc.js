module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-native/all',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'off',
    'react-native/sort-styles': 'off',
  },
  overrides: [
    {
      files: ['backend/convex/**/*.ts'],
      parserOptions: {
        project: './backend/tsconfig.json',
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react-hooks/rules-of-hooks': 'off',
        'react-native/no-unused-styles': 'off',
      },
    },
    {
      files: ['frontend/**/*.{ts,tsx}'],
      parserOptions: {
        project: './frontend/tsconfig.json',
      },
    },
    {
      files: ['packages/shared/**/*.ts'],
      parserOptions: {
        project: './packages/shared/tsconfig.json',
      },
    },
    {
      files: ['*.js'],
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
    },
  ],
};
