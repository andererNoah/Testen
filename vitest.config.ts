import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "modules/*/test/**/*.test.ts", "apps/api/test/**/*.test.ts"],
    environment: "node",
    globalSetup: ["./packages/db/test-support/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
