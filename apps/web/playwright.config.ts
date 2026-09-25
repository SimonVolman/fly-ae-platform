import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(webRoot, "../..");
const baseURL = process.env.UI_BASE_URL ?? "http://127.0.0.1:4173";
const resultsDirectory = resolve(repositoryRoot, "artifacts/ui/results");
const reportDirectory = resolve(repositoryRoot, "artifacts/ui/report");

export default defineConfig({
  testDir: resolve(webRoot, "tests/ui"),
  outputDir: resultsDirectory,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: reportDirectory, open: "never" }],
  ],
  use: {
    baseURL,
    serviceWorkers: "block",
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
    {
      name: "tablet-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: process.env.UI_BASE_URL ? undefined : {
    command: "npm run dev --workspace @fly-ae/web -- -H 127.0.0.1 -p 4173",
    cwd: repositoryRoot,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PLAYWRIGHT_UI: "1",
      NEXT_PUBLIC_API_URL: `${baseURL}/api/v1`,
      NEXT_PUBLIC_MAINTENANCE_MODE: "false",
      NEXT_PUBLIC_TEMPORARY_SHARE_ENABLED: "true",
      NEXT_PUBLIC_FUTURE_PRIVACY_COPY: "false",
    },
  },
});
