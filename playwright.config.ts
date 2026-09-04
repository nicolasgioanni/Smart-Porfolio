import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const linuxSkeletonSnapshotPath = "{testDir}/__screenshots__/linux/{testFilePath}/{arg}{ext}";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/playwright",
  snapshotPathTemplate: linuxSkeletonSnapshotPath,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { open: "never", outputFolder: "playwright-report" }]
      ]
    : "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    env: {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "playwright-test-site-key",
      NEXT_TELEMETRY_DISABLED: "1"
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
