module.exports = {
  preset: 'jest-expo',
  testTimeout: 15000,
  testMatch: ['**/__tests__/**/*.test.tsx'],
  moduleNameMapper: { '^@topout/shared$': '<rootDir>/../../packages/shared/src/index.ts' },
};
