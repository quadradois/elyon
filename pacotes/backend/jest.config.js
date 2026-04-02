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
  // Coverage threshold — impede regressão abaixo de 80%
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 65,
      functions: 70,
      lines: 80,
    },
  },
};
