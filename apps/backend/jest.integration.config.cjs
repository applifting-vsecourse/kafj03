const { jest } = require('./package.json');

module.exports = {
  ...jest,
  moduleFileExtensions: [...jest.moduleFileExtensions, 'tsx'],
  testRegex: '\\.int-spec\\.ts$',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  setupFilesAfterEnv: ['<rootDir>/test/reset-integration-database.cjs'],
};
