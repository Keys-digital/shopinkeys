module.exports = {
  testEnvironment: "node", // Ensures Jest runs in a Node.js environment
  setupFilesAfterEnv: ["<rootDir>/tests/utils/setupTests.js"], // Runs before tests
  collectCoverage: true, // Collects test coverage data
  coverageDirectory: "coverage", // Stores coverage reports in a folder
  clearMocks: true, // Clears mocks between tests
  testTimeout: 30000, // ⬅ Increase timeout to 30 seconds
};
