import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_HEADERS_PORT ?? 3111);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/headers",
  outputDir: "test-results/response-headers",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: `npm run build:generated && npx --no-install wrangler pages dev out --ip 127.0.0.1 --port ${port} --log-level warn`,
    env: {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "playwright-test-site-key",
      NEXT_TELEMETRY_DISABLED: "1"
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
