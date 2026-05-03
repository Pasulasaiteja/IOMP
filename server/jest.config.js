module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'routes/**/*.js',
    '!**/__tests__/**'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/server/node_modules/'
  ]
};
