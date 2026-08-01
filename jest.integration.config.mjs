import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFiles: ["<rootDir>/tests/integration/env.cjs"],
  setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
  testEnvironment: "node",
  testMatch: ["**/tests/integration/**/*.integration.test.ts"],
  moduleDirectories: ["node_modules", "<rootDir>/"],
  testTimeout: 45000,
  // SDK do Firebase mantém conexões abertas com os emulators.
  forceExit: true,
};

export default createJestConfig(customJestConfig);
