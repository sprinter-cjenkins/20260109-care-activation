// test/jest-e2e.config.js
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../tsconfig.json');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/../', // since jest-e2e.config.js lives in /test
  }),
};
