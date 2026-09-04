import { expect, test, type Locator, type Page } from "@playwright/test";

type RecommendationGeometry = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type RecommendationLayoutSample = {
  cardPosition: string;
  collapsedHeight: string;
  rowTop: number;
};

async function settleLayout(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  });
}

async function waitForStableHeight(locator: Locator) {
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        let previousHeight = -1;
        let stableFrames = 0;

        const sample = () => {
          const nextHeight = element.getBoundingClientRect().height;
          stableFrames = Math.abs(nextHeight - previousHeight) <= 0.25 ? stableFrames + 1 : 0;
          previousHeight = nextHeight;

          if (stableFrames >= 4) {
            resolve();
            return;
          }

          window.requestAnimationFrame(sample);
        };

        window.requestAnimationFrame(sample);
      })
  );
}

async function getDocumentTop(locator: Locator): Promise<number> {
  return locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
}

async function sampleDesktopLayout(
  rowSlot: Locator,
  measuredSlotIndex: number,
  durationMs = 620
): Promise<RecommendationLayoutSample[]> {
  return rowSlot.evaluate(
    (element, { durationMs: sampleDuration, measuredSlotIndex: sampleSlotIndex }) =>
      new Promise<RecommendationLayoutSample[]>((resolve) => {
        const samples: RecommendationLayoutSample[] = [];
        const measuredSlot = document.querySelectorAll<HTMLElement>(".recommendations-list__item")[sampleSlotIndex];
        const measuredCard = measuredSlot?.querySelector<HTMLElement>(".recommendation-card--detail");
        const startedAt = performance.now();

        const sample = () => {
          samples.push({
            cardPosition: measuredCard ? getComputedStyle(measuredCard).position : "missing",
            collapsedHeight: measuredSlot?.style.getPropertyValue("--recommendation-detail-collapsed-height") ?? "",
            rowTop: element.getBoundingClientRect().top + window.scrollY
          });

          if (performance.now() - startedAt >= sampleDuration) {
            resolve(samples);
            return;
          }

          window.requestAnimationFrame(sample);
        };

        window.requestAnimationFrame(sample);
      }),
    { durationMs, measuredSlotIndex }
  );
}

function expectStableDesktopLayout(
  samples: RecommendationLayoutSample[],
  expectedRowTop: number,
  expectedCollapsedHeight: string
) {
  expect(samples.length).toBeGreaterThan(2);
  const expectedCollapsedHeightValue = Number.parseFloat(expectedCollapsedHeight);

  for (const sample of samples) {
    expect(Math.abs(sample.rowTop - expectedRowTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(Number.parseFloat(sample.collapsedHeight) - expectedCollapsedHeightValue)).toBeLessThanOrEqual(1);
    expect(sample.cardPosition).toBe("absolute");
  }
}

function geometriesOverlap(active: RecommendationGeometry, candidate: RecommendationGeometry): boolean {
  return (
    active.left < candidate.right - 1 &&
    active.right > candidate.left + 1 &&
    active.top < candidate.bottom - 1 &&
    active.bottom > candidate.top + 1
  );
}

test.describe("recommendation cards", () => {
  test("keeps desktop rows fixed and dims exactly the cards covered by the active overlay", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/recommendations");
    await settleLayout(page);

    const list = page.locator(".recommendations-list");
    const slots = list.locator(".recommendations-list__item");
    const firstSlot = slots.nth(0);
    const firstCard = firstSlot.locator(".recommendation-card--detail");
    const secondRowTopBefore = await getDocumentTop(slots.nth(2));
    const collapsedHeight = (await firstCard.boundingBox())?.height ?? 0;
    const cachedCollapsedHeight = await firstSlot.evaluate((element) =>
      element.style.getPropertyValue("--recommendation-detail-collapsed-height")
    );

    await expect(list).toHaveAttribute("data-layout-mode", "overlay");
    await expect(list).toHaveAttribute("data-overlay-ready", "true");
    await firstSlot.getByRole("button", { name: /show more recommendation/i }).click();
    await expect(firstSlot).toHaveAttribute("data-expanded", "true");
    await waitForStableHeight(firstCard);

    expect((await firstCard.boundingBox())?.height ?? 0).toBeGreaterThan(collapsedHeight);
    expect(Math.abs((await getDocumentTop(slots.nth(2))) - secondRowTopBefore)).toBeLessThanOrEqual(1);

    const cards = slots.locator(".recommendation-card--detail");
    const geometries = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
      })
    );
    const expectedOverlap = geometries.map((geometry, index) =>
      index === 0 ? false : geometriesOverlap(geometries[0]!, geometry)
    );

    await expect
      .poll(() => slots.evaluateAll((elements) => elements.map((element) => element.dataset.overlapped === "true")))
      .toEqual(expectedOverlap);

    for (let index = 0; index < expectedOverlap.length; index += 1) {
      const expectedOpacity = expectedOverlap[index] ? 0.58 : 1;
      await expect
        .poll(() => slots.nth(index).evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
        .toBeCloseTo(expectedOpacity, 2);
    }

    const expectedThemeSurfaces = {
      dark: "rgb(20, 24, 31)",
      light: "rgb(254, 254, 255)",
      navy: "rgb(8, 22, 39)"
    } as const;

    for (const [theme, expectedBackground] of Object.entries(expectedThemeSurfaces)) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme;
      }, theme);
      await expect.poll(() => firstCard.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
        expectedBackground
      );
    }

    await firstSlot.getByRole("button", { name: /show less recommendation/i }).click();
    await expect(firstSlot).toHaveAttribute("data-expanded", "false");
    expectStableDesktopLayout(
      await sampleDesktopLayout(slots.nth(2), 0),
      secondRowTopBefore,
      cachedCollapsedHeight
    );

    await firstSlot.getByRole("button", { name: /show more recommendation/i }).click();
    await expect(firstSlot).toHaveAttribute("data-expanded", "true");
    await waitForStableHeight(firstCard);

    const secondSlot = slots.nth(1);
    await secondSlot.getByRole("button", { name: /show more recommendation/i }).click();
    await expect(secondSlot).toHaveAttribute("data-expanded", "true");
    expectStableDesktopLayout(
      await sampleDesktopLayout(slots.nth(2), 0),
      secondRowTopBefore,
      cachedCollapsedHeight
    );

    await secondSlot.getByRole("button", { name: /show less recommendation/i }).click();
    await expect(secondSlot).toHaveAttribute("data-expanded", "false");
    await waitForStableHeight(secondSlot.locator(".recommendation-card--detail"));

    const bottomSlot = slots.nth(2);
    await bottomSlot.getByRole("button", { name: /show more recommendation/i }).click();
    await expect(bottomSlot).toHaveAttribute("data-expanded", "true");
    await waitForStableHeight(bottomSlot.locator(".recommendation-card--detail"));

    const footerClearance = await page.evaluate(() => {
      const activeCard = document.querySelector<HTMLElement>(
        '.recommendations-list__item[data-expanded="true"] .recommendation-card--detail'
      );
      const footer = document.querySelector<HTMLElement>(".blob-footer");
      if (!activeCard || !footer) return Number.NEGATIVE_INFINITY;

      return footer.getBoundingClientRect().top - activeCard.getBoundingClientRect().bottom;
    });
    expect(footerClearance).toBeGreaterThanOrEqual(-1);
  });

  test("uses natural flow without dimming or horizontal overflow at responsive widths", async ({ page }) => {
    for (const width of [980, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/recommendations");
      await settleLayout(page);

      const list = page.locator(".recommendations-list");
      const slots = list.locator(".recommendations-list__item");
      const expandableIndex = await slots.evaluateAll((elements) =>
        elements.findIndex((element) => element.querySelector(".recommendation-expandable__toggle"))
      );
      expect(expandableIndex).toBeGreaterThanOrEqual(0);
      expect(expandableIndex).toBeLessThan(3);
      const expandableSlot = slots.nth(expandableIndex);
      const followingSlot = slots.nth(expandableIndex + 1);
      const followingTopBefore = await getDocumentTop(followingSlot);

      await expect(list).toHaveAttribute("data-layout-mode", "natural");
      await expandableSlot.getByRole("button", { name: /show more recommendation/i }).click();
      await expect(expandableSlot).toHaveAttribute("data-expanded", "true");
      await waitForStableHeight(expandableSlot.locator(".recommendation-card--detail"));

      expect(await getDocumentTop(followingSlot)).toBeGreaterThan(followingTopBefore);
      await expect(slots).toHaveCount(4);
      expect(await slots.evaluateAll((elements) => elements.map((element) => element.dataset.overlapped))).toEqual([
        "false",
        "false",
        "false",
        "false"
      ]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
      ).toBe(true);
    }
  });

  test("supports Escape, cross-card focus collapse, and reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/recommendations");
    await settleLayout(page);

    const list = page.locator(".recommendations-list");
    const slots = list.locator(".recommendations-list__item");
    const firstToggle = slots.nth(0).getByRole("button", { name: /show more recommendation/i });

    await firstToggle.focus();
    await page.keyboard.press("Enter");
    await expect(slots.nth(0)).toHaveAttribute("data-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(slots.nth(0)).toHaveAttribute("data-expanded", "false");
    await expect(firstToggle).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(slots.nth(0)).toHaveAttribute("data-expanded", "true");
    await slots.nth(1).getByRole("link", { name: /linkedin profile/i }).focus();
    await expect(slots.nth(0)).toHaveAttribute("data-expanded", "false");

    expect(
      await list.evaluate((element) => ({
        list: getComputedStyle(element).transitionDuration,
        slot: getComputedStyle(element.querySelector<HTMLElement>(".recommendations-list__item")!).transitionDuration,
        viewport: getComputedStyle(
          element.querySelector<HTMLElement>(".recommendation-expandable__viewport")!
        ).transitionDuration
      }))
    ).toEqual({ list: "0s", slot: "0s", viewport: "0s" });
  });
});
