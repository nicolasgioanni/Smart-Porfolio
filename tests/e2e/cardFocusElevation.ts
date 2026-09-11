import { expect, type Locator, type Page } from "@playwright/test";

const themeNames = ["navy", "light", "dark"] as const;

type CardElevation = {
  boxShadow: string;
  transform: string;
};

async function waitForPaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      })
  );
}

async function waitForScrollToSettle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let previousScrollY = window.scrollY;
        let sampledFrames = 0;
        let stillFrames = 0;

        function observeScroll() {
          window.requestAnimationFrame(() => {
            const currentScrollY = window.scrollY;
            stillFrames = currentScrollY === previousScrollY ? stillFrames + 1 : 0;
            previousScrollY = currentScrollY;
            sampledFrames += 1;

            if (stillFrames >= 3 || sampledFrames >= 120) {
              resolve();
            } else {
              observeScroll();
            }
          });
        }

        observeScroll();
      })
  );
}

async function readElevation(card: Locator): Promise<CardElevation> {
  return card.evaluate((element) => {
    const styles = window.getComputedStyle(element);

    return {
      boxShadow: styles.boxShadow,
      transform: styles.transform
    };
  });
}

async function clearFocus(page: Page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

export async function findFirstExpandableCard(cards: Locator): Promise<Locator | undefined> {
  const count = await cards.count();

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    if (await card.locator("button.detail-section__trigger").count()) return card;
  }

  return undefined;
}

export async function expectDisclosureFocusToKeepRestingElevation(page: Page, card: Locator) {
  const disclosure = card.locator("button.detail-section__trigger").first();

  for (const themeName of themeNames) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, themeName);
    await expect(page.locator("html")).toHaveAttribute("data-theme", themeName);

    await card.scrollIntoViewIfNeeded();
    await clearFocus(page);
    await page.mouse.move(1, 1);
    await waitForPaint(page);

    const restingElevation = await readElevation(card);

    await disclosure.click();
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    await expect(disclosure).toBeFocused();

    await page.mouse.move(1, 1);
    const scrollYBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 360);
    await waitForScrollToSettle(page);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollYBefore);
    const scrollYAfterDown = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, -180);
    await waitForScrollToSettle(page);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrollYAfterDown);
    await waitForPaint(page);

    await expect
      .poll(() =>
        card.evaluate((element) => ({
          focusWithin: element.matches(":focus-within"),
          hovered: element.matches(":hover")
        }))
      )
      .toEqual({ focusWithin: true, hovered: false });
    await expect.poll(() => readElevation(card)).toEqual(restingElevation);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
      )
      .toBe(true);

    await disclosure.press("Escape");
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  }
}
