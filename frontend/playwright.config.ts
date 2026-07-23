import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "https://amrogen.com";
const apiURL = process.env.E2E_API_URL || "https://amrogen-backend-zgoudwucaq-ew.a.run.app";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "e2e-report" }],
    ["json", { outputFile: "e2e-results.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      "User-Agent": "AmroGen-E2E/1.0",
    },
  },
  projects: [
    {
      name: "api-contract",
      testMatch: /(api-contract|gaps)\.spec\.ts/,
      use: {
        baseURL: apiURL,
      },
    },
    {
      name: "browser-chromium",
      testMatch: /browser\/(?!runtime-wiring).*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
      },
    },
    {
      name: "wiring",
      testMatch: /browser\/runtime-wiring\.spec\.ts/,
      use: {
        baseURL,
      },
    },
  ],
});
