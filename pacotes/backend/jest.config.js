/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Ignorar node_modules e dist
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Timeout generoso para testes com mocks async
  testTimeout: 10000,
};
