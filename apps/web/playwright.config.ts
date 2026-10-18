import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const API_PORT = 3100;
const WEB_PORT = 5174;
// Container images ship Chromium under /opt/pw-browsers; elsewhere Playwright's own download is used.
const executablePath = process.env.PW_CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: [
    {
      command: "pnpm --filter @hv/api exec tsx src/e2e-server.ts",
      url: `http://127.0.0.1:${API_PORT}/v1/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: "pipe",
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: { HV_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
