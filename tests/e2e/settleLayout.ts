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

/** Waits for the finite resolved-page entrance before capturing a geometry baseline. */
export async function settlePageEntryMotion(page: Page) {
  await page.locator(".site-main > .page-container").evaluate(async (element) => {
    const pageEntryAnimations = element.getAnimations().filter(
      (animation) =>
        animation instanceof CSSAnimation &&
        animation.animationName === "page-body-enter" &&
        animation.effect?.getComputedTiming().iterations === 1
    );

    await Promise.all(pageEntryAnimations.map((animation) => animation.finished.catch(() => undefined)));
  });
}
