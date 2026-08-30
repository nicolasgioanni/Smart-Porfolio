import { expect, test, type Locator, type Page } from "@playwright/test";
import { selectThemeWithChooser } from "./themePreference";

type RecommendationGeometry = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type RecommendationLayoutSample = {
  cardPositions: string[];
  collapsedHeights: string[];
  slotTops: number[];
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

async function getDesktopLayoutSnapshot(list: Locator) {
  return list.evaluate((element) => {
    const slots = Array.from(element.querySelectorAll<HTMLElement>(".recommendations-list__item"));

    return {
      collapsedHeights: slots.map((slot) =>
        slot.style.getPropertyValue("--recommendation-detail-collapsed-height")
      ),
      slotTops: slots.map((slot) => slot.getBoundingClientRect().top + window.scrollY)
    };
  });
}

async function sampleDesktopLayout(list: Locator, durationMs = 620): Promise<RecommendationLayoutSample[]> {
  return list.evaluate(
    (element, sampleDuration) =>
      new Promise<RecommendationLayoutSample[]>((resolve) => {
        const samples: RecommendationLayoutSample[] = [];
        const startedAt = performance.now();

        const sample = () => {
          const slots = Array.from(element.querySelectorAll<HTMLElement>(".recommendations-list__item"));

          samples.push({
            cardPositions: slots.map((slot) => {
              const card = slot.querySelector<HTMLElement>(".recommendation-card--detail");
              return card ? getComputedStyle(card).position : "missing";
            }),
            collapsedHeights: slots.map((slot) =>
              slot.style.getPropertyValue("--recommendation-detail-collapsed-height")
            ),
            slotTops: slots.map((slot) => slot.getBoundingClientRect().top + window.scrollY)
          });

          if (performance.now() - startedAt >= sampleDuration) {
            resolve(samples);
            return;
          }

          window.requestAnimationFrame(sample);
        };

        window.requestAnimationFrame(sample);
      }),
    durationMs
  );
}

function expectStableDesktopLayout(
  samples: RecommendationLayoutSample[],
  expectedSlotTops: number[],
  expectedCollapsedHeights: string[]
) {
  expect(samples.length).toBeGreaterThan(2);

  for (const sample of samples) {
    expect(sample.cardPositions).toEqual(expectedSlotTops.map(() => "absolute"));

    for (let index = 0; index < expectedSlotTops.length; index += 1) {
      expect(Math.abs(sample.slotTops[index]! - expectedSlotTops[index]!)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          Number.parseFloat(sample.collapsedHeights[index]!) -
            Number.parseFloat(expectedCollapsedHeights[index]!)
        )
      ).toBeLessThanOrEqual(1);
    }
  }
}

async function expectDesktopOverlayCleared(list: Locator) {
  const slotCount = await list.locator(".recommendations-list__item").count();

  await expect
    .poll(() =>
      list.locator(".recommendations-list__item").evaluateAll((slots) =>
        slots.map((slot) => ({
          expanded: slot.dataset.expanded,
          opacity: Number.parseFloat(getComputedStyle(slot).opacity),
          overlapped: slot.dataset.overlapped
        }))
      )
    )
    .toEqual(
      Array.from({ length: slotCount }, () => ({
        expanded: "false",
        opacity: 1,
        overlapped: "false"
      }))
    );
  await expect
    .poll(() =>
      list.evaluate((element) => ({
        paddingBottom: Number.parseFloat(getComputedStyle(element).paddingBottom),
        reserve: element.style.getPropertyValue("--recommendations-overlay-reserve")
      }))
    )
    .toEqual({ paddingBottom: 0, reserve: "0px" });
}

function geometriesOverlap(active: RecommendationGeometry, candidate: RecommendationGeometry): boolean {
  return (
    active.left < candidate.right - 1 &&
    active.right > candidate.left + 1 &&
    active.top < candidate.bottom - 1 &&
    active.bottom > candidate.top + 1
  );
}

async function getExpandableSlotIndexes(slots: Locator): Promise<number[]> {
  return slots.evaluateAll((elements) =>
    elements.flatMap((element, index) =>
      element.querySelector(".recommendation-expandable__toggle") ? [index] : []
    )
  );
}

async function getFocusableSlotIndex(slots: Locator, excludedIndex: number): Promise<number> {
  return slots.evaluateAll(
    (elements, excluded) =>
      elements.findIndex(
        (element, index) =>
          index !== excluded &&
          Boolean(element.querySelector('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      ),
    excludedIndex
  );
}

test.describe("recommendation cards", () => {
  test("keeps desktop rows fixed and dims exactly the cards covered by the active overlay", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/recommendations");
    await settleLayout(page);

    const list = page.locator(".recommendations-list");
    const slots = list.locator(".recommendations-list__item");
    await expect(list).toHaveAttribute("data-layout-mode", "overlay");
    const expandableIndexes = await getExpandableSlotIndexes(slots);
    const initialSlotTops = await slots.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top + window.scrollY)
    );
    const activeIndex = expandableIndexes.find((index) =>
      initialSlotTops.some((top) => top > initialSlotTops[index]! + 1)
    );
    test.skip(activeIndex === undefined, "Desktop overlay regression requires an expandable card with a later row");

    const activeSlot = slots.nth(activeIndex!);
    const activeCard = activeSlot.locator(".recommendation-card--detail");
    const followingRowIndex = initialSlotTops.findIndex((top) => top > initialSlotTops[activeIndex!]! + 1);
    const followingRowTopBefore = await getDocumentTop(slots.nth(followingRowIndex));
    const collapsedHeight = (await activeCard.boundingBox())?.height ?? 0;

    await expect(list).toHaveAttribute("data-overlay-ready", "true");
    const collapsedLayout = await getDesktopLayoutSnapshot(list);
    await activeSlot.getByRole("button", { name: /show more recommendation/i }).click();
    await expect(activeSlot).toHaveAttribute("data-expanded", "true");
    expectStableDesktopLayout(
      await sampleDesktopLayout(list),
      collapsedLayout.slotTops,
      collapsedLayout.collapsedHeights
    );

    expect((await activeCard.boundingBox())?.height ?? 0).toBeGreaterThan(collapsedHeight);
    expect(Math.abs((await getDocumentTop(slots.nth(followingRowIndex))) - followingRowTopBefore)).toBeLessThanOrEqual(
      1
    );

    const cards = slots.locator(".recommendation-card--detail");
    const geometries = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
      })
    );
    const expectedOverlap = geometries.map((geometry, index) =>
      index === activeIndex ? false : geometriesOverlap(geometries[activeIndex!]!, geometry)
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

    await activeSlot.getByRole("button", { name: /show less recommendation/i }).click();
    await expect(activeSlot).toHaveAttribute("data-expanded", "false");
    expectStableDesktopLayout(
      await sampleDesktopLayout(list),
      collapsedLayout.slotTops,
      collapsedLayout.collapsedHeights
    );
    await expectDesktopOverlayCleared(list);

    const expectedThemeSurfaces = {
      dark: "rgb(35, 38, 45)",
      light: "rgb(229, 236, 240)",
      navy: "rgb(17, 43, 69)"
    } as const;

    for (const [theme, expectedBackground] of Object.entries(expectedThemeSurfaces)) {
      await selectThemeWithChooser(page, theme as keyof typeof expectedThemeSurfaces);
      const paletteCollapsedLayout = await getDesktopLayoutSnapshot(list);
      await activeSlot.getByRole("button", { name: /show more recommendation/i }).click();
      await expect(activeSlot).toHaveAttribute("data-expanded", "true");
      await expect.poll(() => activeCard.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
        expectedBackground
      );
      expectStableDesktopLayout(
        await sampleDesktopLayout(list),
        paletteCollapsedLayout.slotTops,
        paletteCollapsedLayout.collapsedHeights
      );
      await activeSlot.getByRole("button", { name: /show less recommendation/i }).click();
      await expect(activeSlot).toHaveAttribute("data-expanded", "false");
      expectStableDesktopLayout(
        await sampleDesktopLayout(list),
        paletteCollapsedLayout.slotTops,
        paletteCollapsedLayout.collapsedHeights
      );
      await expectDesktopOverlayCleared(list);
    }

    const focusableSlotIndex = await getFocusableSlotIndex(slots, activeIndex!);
    if (focusableSlotIndex >= 0) {
      await activeSlot.getByRole("button", { name: /show more recommendation/i }).click();
      await expect(activeSlot).toHaveAttribute("data-expanded", "true");
      await waitForStableHeight(activeCard);

      await slots
        .nth(focusableSlotIndex)
        .locator('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
        .first()
        .focus();
      await expect(activeSlot).toHaveAttribute("data-expanded", "false");
      expectStableDesktopLayout(
        await sampleDesktopLayout(list),
        collapsedLayout.slotTops,
        collapsedLayout.collapsedHeights
      );
      await expectDesktopOverlayCleared(list);
    }

    await activeSlot.getByRole("button", { name: /show more recommendation/i }).click();
    await expect(activeSlot).toHaveAttribute("data-expanded", "true");
    await waitForStableHeight(activeCard);

    await page.getByRole("heading", { level: 1, name: "Recommendations" }).click();
    await expect(activeSlot).toHaveAttribute("data-expanded", "false");
    expectStableDesktopLayout(
      await sampleDesktopLayout(list),
      collapsedLayout.slotTops,
      collapsedLayout.collapsedHeights
    );
    await expectDesktopOverlayCleared(list);

    const switchIndex = expandableIndexes.find((index) => index !== activeIndex);
    if (switchIndex !== undefined) {
      const switchSlot = slots.nth(switchIndex);

      await activeSlot.getByRole("button", { name: /show more recommendation/i }).click();
      await expect(activeSlot).toHaveAttribute("data-expanded", "true");
      await waitForStableHeight(activeCard);

      await switchSlot.getByRole("button", { name: /show more recommendation/i }).click();
      await expect(switchSlot).toHaveAttribute("data-expanded", "true");
      expectStableDesktopLayout(
        await sampleDesktopLayout(list),
        collapsedLayout.slotTops,
        collapsedLayout.collapsedHeights
      );

      await switchSlot.getByRole("button", { name: /show less recommendation/i }).click();
      await expect(switchSlot).toHaveAttribute("data-expanded", "false");
      await waitForStableHeight(switchSlot.locator(".recommendation-card--detail"));
    }

    const lastRowTop = Math.max(...initialSlotTops);
    const bottomExpandableIndex = expandableIndexes.find(
      (index) => Math.abs(initialSlotTops[index]! - lastRowTop) <= 1
    );
    if (bottomExpandableIndex !== undefined) {
      const bottomSlot = slots.nth(bottomExpandableIndex);

      await bottomSlot.getByRole("button", { name: /show more recommendation/i }).click();
      await expect(bottomSlot).toHaveAttribute("data-expanded", "true");
      await waitForStableHeight(bottomSlot.locator(".recommendation-card--detail"));

      const footerClearance = await page.evaluate(() => {
        const expandedCard = document.querySelector<HTMLElement>(
          '.recommendations-list__item[data-expanded="true"] .recommendation-card--detail'
        );
        const footer = document.querySelector<HTMLElement>(".blob-footer");
        if (!expandedCard || !footer) return Number.NEGATIVE_INFINITY;

        return footer.getBoundingClientRect().top - expandedCard.getBoundingClientRect().bottom;
      });
      expect(footerClearance).toBeGreaterThanOrEqual(-1);
    }
  });

  test("uses natural flow without dimming or horizontal overflow at responsive widths", async ({ page }) => {
    for (const width of [980, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/recommendations");
      await settleLayout(page);

      const list = page.locator(".recommendations-list");
      const slots = list.locator(".recommendations-list__item");
      const slotCount = await slots.count();
      if (slotCount === 0) {
        await expect(page.getByRole("heading", { name: "No recommendations yet" })).toBeVisible();
      }
      test.skip(slotCount === 0, "Responsive disclosure regression requires recommendation content");

      const expandableIndexes = await getExpandableSlotIndexes(slots);
      const expandableIndex = expandableIndexes.find((index) => index < slotCount - 1);
      test.skip(
        expandableIndex === undefined,
        "Responsive flow regression requires an expandable recommendation followed by another card"
      );

      const expandableSlot = slots.nth(expandableIndex!);
      const followingSlot = slots.nth(expandableIndex! + 1);
      const followingTopBefore = await getDocumentTop(followingSlot);

      await expect(list).toHaveAttribute("data-layout-mode", "natural");
      await expandableSlot.getByRole("button", { name: /show more recommendation/i }).click();
      await expect(expandableSlot).toHaveAttribute("data-expanded", "true");
      await waitForStableHeight(expandableSlot.locator(".recommendation-card--detail"));

      expect(await getDocumentTop(followingSlot)).toBeGreaterThan(followingTopBefore);
      await expect(slots).toHaveCount(slotCount);
      expect(await slots.evaluateAll((elements) => elements.map((element) => element.dataset.overlapped))).toEqual(
        Array.from({ length: slotCount }, () => "false")
      );

      const switchIndex = expandableIndexes.find((index) => index !== expandableIndex);
      if (switchIndex !== undefined) {
        const switchSlot = slots.nth(switchIndex);
        const switchToggle = switchSlot.getByRole("button", { name: /show more recommendation/i });

        await switchToggle.scrollIntoViewIfNeeded();
        const switchTopBeforePress = await getDocumentTop(switchSlot);
        const switchBox = await switchToggle.boundingBox();
        expect(switchBox).not.toBeNull();

        await page.mouse.move(switchBox!.x + switchBox!.width / 2, switchBox!.y + switchBox!.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(120);

        await expect(expandableSlot).toHaveAttribute("data-expanded", "true");
        expect(Math.abs((await getDocumentTop(switchSlot)) - switchTopBeforePress)).toBeLessThanOrEqual(1);

        await page.mouse.up();
        await expect(expandableSlot).toHaveAttribute("data-expanded", "false");
        await expect(switchSlot).toHaveAttribute("data-expanded", "true");
      }

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
    const slotCount = await slots.count();
    if (slotCount === 0) {
      await expect(page.getByRole("heading", { name: "No recommendations yet" })).toBeVisible();
    }
    test.skip(slotCount === 0, "Keyboard disclosure regression requires recommendation content");

    const expandableIndexes = await getExpandableSlotIndexes(slots);
    const activeIndex = expandableIndexes[0];
    test.skip(activeIndex === undefined, "Keyboard disclosure regression requires an expandable recommendation");

    const activeSlot = slots.nth(activeIndex!);
    const activeToggle = activeSlot.getByRole("button", { name: /show more recommendation/i });

    await activeToggle.focus();
    await page.keyboard.press("Enter");
    await expect(activeSlot).toHaveAttribute("data-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(activeSlot).toHaveAttribute("data-expanded", "false");
    await expect(activeToggle).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(activeSlot).toHaveAttribute("data-expanded", "true");
    const focusableSlotIndex = await getFocusableSlotIndex(slots, activeIndex!);
    if (focusableSlotIndex >= 0) {
      await slots
        .nth(focusableSlotIndex)
        .locator('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
        .first()
        .focus();
    } else {
      await page.getByRole("heading", { level: 1, name: "Recommendations" }).click();
    }
    await expect(activeSlot).toHaveAttribute("data-expanded", "false");

    expect(
      await activeSlot.evaluate((element) => ({
        list: getComputedStyle(element.closest<HTMLElement>(".recommendations-list")!).transitionDuration,
        slot: getComputedStyle(element).transitionDuration,
        viewport: getComputedStyle(element.querySelector<HTMLElement>(".recommendation-expandable__viewport")!)
          .transitionDuration
      }))
    ).toEqual({ list: "0s", slot: "0s", viewport: "0s" });
  });
});
