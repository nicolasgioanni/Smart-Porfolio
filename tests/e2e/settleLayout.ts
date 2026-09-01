import type { Page } from "@playwright/test";

/** Waits for the rendered layout without requiring long-lived media requests to become idle. */
export async function settleLayout(page: Page, { waitForNetworkIdle = false } = {}) {
  await page.waitForLoadState(waitForNetworkIdle ? "networkidle" : "load");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  });
}
