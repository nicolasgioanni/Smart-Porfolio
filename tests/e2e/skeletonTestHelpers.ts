import type { Page } from "@playwright/test";

export async function settleDocumentLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  });
}

export async function prepareDarkPage(page: Page, reducedMotion: "no-preference" | "reduce"): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion });
  await page.goto("/");
}

export async function suppressViewportPrefetch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class DisabledIntersectionObserver {
      readonly root = null;
      readonly rootMargin = "0px";
      readonly thresholds = [];

      constructor() {}

      disconnect() {}
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    }

    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: DisabledIntersectionObserver,
      writable: true
    });
  });
}
