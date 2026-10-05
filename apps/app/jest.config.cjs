module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  testTimeout: 15000,
  testMatch: ['**/__tests__/**/*.test.tsx'],
  moduleNameMapper: { '^@topout/shared$': '<rootDir>/../../packages/shared/src/index.ts' },
};
