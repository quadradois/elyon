/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test/baseline'],
  testMatch: ['**/*.integration.test.ts'],
  testTimeout: 45000,
  maxWorkers: 1,
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.integration.json' }] },
};
