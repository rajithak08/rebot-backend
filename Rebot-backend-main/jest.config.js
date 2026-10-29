export default {
  testEnvironment: "node",
  transform: {},
  extensionsToTreatAsEsm: [],
  testMatch: ["**/tests/**/*.test.js"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "controllers/**/*.js",
    "!controllers/**/index.js",
  ],
  coverageReporters: ["text", "text-summary", "lcov", "html"],
  verbose: true,
  testTimeout: 10000,
};
