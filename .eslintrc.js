module.exports = {
  env: { commonjs: true },
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'simple-import-sort', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  overrides: [
    {
      files: ['*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: '*.js',
      env: { node: true },
      rules: {
        'simple-import-sort/imports': 'off',
        'import/order': ['error', { 'newlines-between': 'always' }],
      },
    },
  ],
  rules: {
    '@typescript-eslint/ban-ts-comment': 'warn',
    'no-console': 'error',
    // import-related
    'simple-import-sort/imports': 'error',
    'sort-imports': 'off',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
