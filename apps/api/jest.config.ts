import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/../tsconfig.spec.json",
      },
    ],
  },
  collectCoverageFrom: ["**/*.ts", "!**/*.module.ts", "!**/main.ts", "!**/*.d.ts"],
  coverageDirectory: "../coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  testEnvironment: "node",
  verbose: true,
};

export default config;
