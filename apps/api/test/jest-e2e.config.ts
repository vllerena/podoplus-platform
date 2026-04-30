import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.spec.json",
      },
    ],
  },
  testEnvironment: "node",
  verbose: true,
  // E2E tests can be slow — allow up to 30 seconds per test
  testTimeout: 30000,
};

export default config;
