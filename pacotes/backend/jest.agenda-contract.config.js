/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test/contract'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 45000,
  maxWorkers: 1,
  setupFiles: ['<rootDir>/test/baseline/baseline.setup.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.integration.json' }] },
};
