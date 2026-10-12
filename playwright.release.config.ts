import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_RELEASE_PORT ?? 3200);
const baseURL = process.env.PLAYWRIGHT_RELEASE_BASE_URL ?? `http://127.0.0.1:${port}`;
const outDirectory = process.env.PLAYWRIGHT_RELEASE_OUT ?? "out";

export default defineConfig({
  testDir: "./scripts/release",
  testMatch: /staticExport\.browser\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  use: { baseURL, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: {
    command: `${JSON.stringify(process.execPath)} scripts/release/pagesStaticRuntime.mjs ${JSON.stringify(outDirectory)} ${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
    url: baseURL
  },
  projects: [{ name: "chromium-static", use: { ...devices["Desktop Chrome"] } }]
});
