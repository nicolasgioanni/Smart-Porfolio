import { expect, test, type Locator, type Page } from "./browserTest";
import {
  expectDisclosureFocusToKeepRestingElevation,
  findFirstExpandableCard
} from "./cardFocusElevation";
import { captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";
import {
  expectStableDetailOverlay,
  getDetailOverlaySample,
  sampleDetailOverlay,
  settleDetailPanelMotion,
  settleDetailOverlayMotion
} from "./detailOverlay";
import { settleLayout } from "./settleLayout";
import { selectThemeWithChooser } from "./themePreference";

test.beforeEach(async ({ page }) => {
  captureBrowserConsole(page);
});

test.afterEach(async ({ page }) => {
  expectNoBrowserConsoleIssues(page);
});

async function expectExperienceCardsOrEmptyState(page: Page): Promise<Locator | undefined> {
  const cards = page.locator("article.experience-card");

  if ((await cards.count()) === 0) {
    await expect(page.getByRole("status")).toContainText("Experience entries will appear here when content is available.");
    return undefined;
  }

  return cards;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
    )
    .toBe(true);
}

async function getExpandableExperienceCardIndexes(cards: Locator): Promise<number[]> {
  const indexes: number[] = [];

  for (let index = 0; index < (await cards.count()); index += 1) {
    if (await cards.nth(index).locator("button.detail-section__trigger").count()) indexes.push(index);
  }

  return indexes;
}
test.describe("Experience showcase", () => {
  test("switches audience depth and keeps available chapters accessible", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/experience");
    await settleLayout(page);

    const introSurface = page.locator(".page-intro__surface");
    const pageHeading = introSurface.getByRole("heading", { level: 1, name: "Experience" });
    const pageSummary = introSurface.locator(".page-description");
    const modeControl = introSurface.locator(".detail-mode-control");
    const modeGroup = modeControl.getByRole("group", { name: /Experience detail level/i });
    const cards = await expectExperienceCardsOrEmptyState(page);

    await expect(introSurface).toHaveCount(1);
    await expect(pageHeading).toBeVisible();
    await expect(pageSummary).toBeVisible();

    if (!cards) {
      await expect(modeControl).toHaveCount(0);
      return;
    }

    await expect(modeControl).toHaveCount(1);
    await expect(introSurface.getByText("Detail", { exact: true })).toBeVisible();
    await expect(modeGroup.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");

    for (const detailButton of await modeGroup.getByRole("button").all()) {
      const detailButtonBox = await detailButton.boundingBox();
      expect(detailButtonBox).not.toBeNull();
      expect(detailButtonBox!.width).toBeGreaterThanOrEqual(44);
      expect(detailButtonBox!.height).toBeGreaterThanOrEqual(44);
    }

    const [headingBox, summaryBox, modeBox, introBox] = await Promise.all([
      pageHeading.boundingBox(),
      pageSummary.boundingBox(),
      modeGroup.boundingBox(),
      introSurface.boundingBox()
    ]);
    expect(headingBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(modeBox).not.toBeNull();
    expect(introBox).not.toBeNull();
    expect(modeBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width);
    expect(modeBox!.y).toBeLessThan(summaryBox!.y);
    expect(modeBox!.x + modeBox!.width).toBeLessThanOrEqual(introBox!.x + introBox!.width);

    await modeGroup.getByRole("button", { name: "Technical" }).click();
    await expect(modeGroup.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
    const liveStatus = modeControl.locator('[aria-live="polite"]');
    await expect(liveStatus).toHaveText("Showing technical details.");
    await expect(liveStatus).toHaveClass(/visually-hidden/);

    const disclosureCard = await findFirstExpandableCard(cards);
    if (!disclosureCard) return;

    const disclosures = disclosureCard.locator("button.detail-section__trigger");
    const firstDisclosure = disclosures.first();
    const hasSecondDisclosure = (await disclosures.count()) >= 2;
    const secondDisclosure = disclosures.nth(1);

    if (hasSecondDisclosure) {
      // Compare matching collapsed icons before opening one rotates its bounding box.
      const [firstIconBox, secondIconBox] = await Promise.all([
        firstDisclosure.locator(".detail-section__icon").boundingBox(),
        secondDisclosure.locator(".detail-section__icon").boundingBox()
      ]);
      expect(firstIconBox).not.toBeNull();
      expect(secondIconBox).not.toBeNull();
      expect(
        Math.abs(firstIconBox!.x + firstIconBox!.width - (secondIconBox!.x + secondIconBox!.width))
      ).toBeLessThanOrEqual(1);
    }

    await firstDisclosure.click();
    await expect(firstDisclosure).toHaveAttribute("aria-expanded", "true");
    const panelId = await firstDisclosure.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = disclosureCard.locator(`[id="${panelId}"]`);
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await expect(panel.getByRole("list").first()).toBeVisible();

    if (!hasSecondDisclosure) return;

    await firstDisclosure.focus();
    await page.keyboard.press("Tab");
    await expect(panel.locator(".detail-section__panel-clip")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(secondDisclosure).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(firstDisclosure).toHaveAttribute("aria-expanded", "false");
    await expect(secondDisclosure).toHaveAttribute("aria-expanded", "true");
    await secondDisclosure.press("Escape");
    await expect(secondDisclosure).toHaveAttribute("aria-expanded", "false");
    await expect(secondDisclosure).toBeFocused();
  });

  test("reflows rendered experience without horizontal overflow and removes motion when requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/experience");
    await settleLayout(page);

    const introSurface = page.locator(".page-intro__surface");
    const modeControl = introSurface.locator(".detail-mode-control");
    const modeLabel = modeControl.locator(".detail-mode-control__label");
    const modeSwitch = modeControl.locator(".detail-mode-switch");
    const cards = await expectExperienceCardsOrEmptyState(page);

    await expectNoHorizontalOverflow(page);

    if (!cards) {
      await expect(modeControl).toHaveCount(0);
      return;
    }

    const technicalButton = modeSwitch.getByRole("button", { name: "Technical", exact: true });
    await expect(technicalButton).toBeVisible();
    expect((await technicalButton.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect((await technicalButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    const firstDisclosure = cards.locator("button.detail-section__trigger").first();
    if (await firstDisclosure.count()) {
      expect((await firstDisclosure.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const [introBox, controlBox, labelBox, switchBox] = await Promise.all([
      introSurface.boundingBox(),
      modeControl.boundingBox(),
      modeLabel.boundingBox(),
      modeSwitch.boundingBox()
    ]);
    expect(introBox).not.toBeNull();
    expect(controlBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    expect(switchBox).not.toBeNull();
    expect(switchBox!.width).toBeLessThanOrEqual(200);
    expect(switchBox!.width).toBeLessThanOrEqual(controlBox!.width);
    expect(switchBox!.x).toBeGreaterThanOrEqual(introBox!.x);
    expect(switchBox!.x + switchBox!.width).toBeLessThanOrEqual(introBox!.x + introBox!.width);
    expect(switchBox!.y).toBeGreaterThanOrEqual(labelBox!.y + labelBox!.height);

    await expect(cards.locator(".experience-card__body").first()).toHaveCSS("animation-name", "none");
    await expect(modeSwitch.locator(".detail-mode-switch__lens")).toHaveCSS("transition-duration", "0s");

    const firstPanel = cards.locator(".detail-section__panel").first();
    if (await firstPanel.count()) {
      await expect(firstPanel).toHaveCSS("transition-duration", "0s");
    }
  });

  test("insets available chapter dividers while preserving full-width hover targets", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/experience");
    await settleLayout(page);

    const cards = await expectExperienceCardsOrEmptyState(page);
    if (!cards) return;

    const chapter = cards.locator(".detail-list .detail-section").first();
    if (!(await chapter.count())) return;

    const trigger = chapter.locator(".detail-section__trigger");
    const dividerInsets = await chapter.evaluate((element) => {
      const chaptersElement = element.parentElement!;
      const topDivider = getComputedStyle(chaptersElement, "::before");
      const rowDivider = getComputedStyle(element, "::before");
      const accentDivider = getComputedStyle(element, "::after");

      return {
        accentLeft: accentDivider.left,
        accentRight: accentDivider.right,
        rowLeft: rowDivider.left,
        rowRight: rowDivider.right,
        topLeft: topDivider.left,
        topRight: topDivider.right
      };
    });
    const [chapterBox, triggerBox] = await Promise.all([chapter.boundingBox(), trigger.boundingBox()]);

    expect(dividerInsets).toEqual({
      accentLeft: "4px",
      accentRight: "4px",
      rowLeft: "4px",
      rowRight: "4px",
      topLeft: "4px",
      topRight: "4px"
    });
    expect(chapterBox).not.toBeNull();
    expect(triggerBox).not.toBeNull();
    expect(Math.abs(chapterBox!.width - triggerBox!.width)).toBeLessThanOrEqual(1);
  });

  test("keeps a long desktop evidence body keyboard-scrollable before Escape restores its summary", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 180 });
    await page.goto("/experience");
    await settleLayout(page);

    const cards = await expectExperienceCardsOrEmptyState(page);
    if (!cards) return;
    const trigger = cards.locator("button.detail-section__trigger").first();
    if (!(await trigger.count())) return;

    const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
    const clip = panel.locator(".detail-section__panel-clip");
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(clip).toBeFocused();

    const scrollable = await clip.evaluate((element) => element.scrollHeight > element.clientHeight);
    expect(scrollable).toBe(true);
    await page.keyboard.press("PageDown");
    await expect.poll(() => clip.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("defers large-viewport touch focus dismissal until the outside button activates", async ({ browser }) => {
    const touchContext = await browser.newContext({ hasTouch: true, viewport: { height: 900, width: 1280 } });
    const touchPage = await touchContext.newPage();
    captureBrowserConsole(touchPage);

    try {
      await touchPage.goto("/experience");
      await settleLayout(touchPage);

      const cards = await expectExperienceCardsOrEmptyState(touchPage);
      if (!cards) return;

      const expandableIndexes = await getExpandableExperienceCardIndexes(cards);
      const activeIndex = expandableIndexes[0];
      const switchIndex = expandableIndexes.find((index) => index !== activeIndex);
      test.skip(activeIndex === undefined || switchIndex === undefined, "Touch ordering needs two expandable Experience cards.");
      if (activeIndex === undefined || switchIndex === undefined) return;

      const activeTrigger = cards.nth(activeIndex).locator("button.detail-section__trigger").last();
      const switchTrigger = cards.nth(switchIndex).locator("button.detail-section__trigger").first();
      const switchTriggerId = await switchTrigger.getAttribute("id");
      if (!switchTriggerId) throw new Error("The touched Experience disclosure needs an id.");

      await switchTrigger.scrollIntoViewIfNeeded();
      await switchTrigger.tap();
      await expect(switchTrigger).toHaveAttribute("aria-expanded", "true");
      await activeTrigger.evaluate((button, openTriggerId) => {
        document.documentElement.removeAttribute("data-detail-expanded-at-outside-touch-activation");
        button.addEventListener(
          "click",
          () => {
            document.documentElement.dataset.detailExpandedAtOutsideTouchActivation =
              document.getElementById(openTriggerId)?.getAttribute("aria-expanded") ?? "missing";
          },
          { once: true }
        );
      }, switchTriggerId);

      await activeTrigger.tap();
      await expect(touchPage.locator("html")).toHaveAttribute("data-detail-expanded-at-outside-touch-activation", "true");
      await expect(switchTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    } finally {
      expectNoBrowserConsoleIssues(touchPage);
      await touchContext.close();
    }
  });

  test("keeps desktop evidence overlays out of route flow through real keyboard and pointer interactions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/experience");
    await settleLayout(page);

    const cards = await expectExperienceCardsOrEmptyState(page);
    if (!cards) return;

    const expandableIndexes = await getExpandableExperienceCardIndexes(cards);
    test.skip(expandableIndexes.length === 0, "Overlay regression requires an expandable Experience card.");

    const cardCount = await cards.count();
    const activeIndex = expandableIndexes.find((index) => index < cardCount - 1);
    test.skip(activeIndex === undefined, "Overlay spill regression requires a following Experience card.");
    if (activeIndex === undefined) return;

    const activeCard = cards.nth(activeIndex);
    const activeTrigger = activeCard.locator("button.detail-section__trigger").last();
    const panel = page.locator(`#${await activeTrigger.getAttribute("aria-controls")}`);
    const root = page.locator("main");
    const selectors = { card: "article.experience-card", resource: ".experience-card__resources" };

    await activeTrigger.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await settleDetailOverlayMotion(root);
    const collapsedLayout = await getDetailOverlaySample(root, selectors);
    const openingSamples = sampleDetailOverlay(root, selectors);
    await activeTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await expect(panel).not.toHaveAttribute("inert");
    await expect(panel).toHaveCSS("position", "absolute");
    await expect(panel.locator(".detail-section__panel-clip")).toHaveCSS("max-height", "540px");
    await expect(panel).toHaveCSS("background-image", "none");
    await expect(panel).toHaveCSS("background-color", /^rgb\(/);
    expectStableDetailOverlay(await openingSamples, collapsedLayout);

    const activePanelId = await panel.getAttribute("id");
    expect(activePanelId).toBeTruthy();
    if (!activePanelId) return;

    const overlayHit = await page.evaluate((panelId) => {
      const panel = document.getElementById(panelId);
      const card = panel?.closest<HTMLElement>("article.experience-card");
      if (!panel || !card) throw new Error("The active Experience panel is missing its card.");

      const cards = Array.from(document.querySelectorAll<HTMLElement>("article.experience-card"));
      const cardIndex = cards.indexOf(card);
      const panelRect = panel.getBoundingClientRect();
      for (const followingCard of cards.slice(cardIndex + 1)) {
        const followingRect = followingCard.getBoundingClientRect();
        const left = Math.max(panelRect.left, followingRect.left, 0);
        const right = Math.min(panelRect.right, followingRect.right, window.innerWidth);
        const top = Math.max(panelRect.top, followingRect.top, 0);
        const bottom = Math.min(panelRect.bottom, followingRect.bottom, window.innerHeight);
        if (right - left < 8 || bottom - top < 8) continue;

        const topElement = document.elementFromPoint(left + 4, top + 4);
        return { overlap: true, panelOwnsTop: Boolean(topElement && panel.contains(topElement)) };
      }

      return { overlap: false, panelOwnsTop: false };
    }, activePanelId);
    expect(overlayHit.overlap).toBe(true);
    expect(overlayHit.panelOwnsTop).toBe(true);

    const closingSamples = sampleDetailOverlay(root, selectors);
    await activeTrigger.press("Escape");
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(activeTrigger).toBeFocused();
    await expect(panel).toHaveAttribute("aria-hidden", "true");
    await expect(panel).toHaveAttribute("inert", "");
    expectStableDetailOverlay(await closingSamples, collapsedLayout);

    await activeTrigger.press("Enter");
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    await activeTrigger.press("Escape");
    await activeTrigger.press("Enter");
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    await settleDetailPanelMotion(panel);
    await expect(activeTrigger.locator("..")).toHaveAttribute("data-visual-state", "open");

    const globalSwitchIndex = expandableIndexes.find((index) => index !== activeIndex);
    if (globalSwitchIndex !== undefined) {
      const switchTrigger = cards.nth(globalSwitchIndex).locator("button.detail-section__trigger").first();

      await switchTrigger.focus();
      const switchingSamples = sampleDetailOverlay(root, selectors);
      await page.keyboard.press("Enter");
      await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(switchTrigger).toHaveAttribute("aria-expanded", "true");
      expectStableDetailOverlay(await switchingSamples, collapsedLayout);

      const switchTriggerId = await switchTrigger.getAttribute("id");
      expect(switchTriggerId).toBeTruthy();
      if (!switchTriggerId) throw new Error("The switched Experience disclosure needs an id.");
      await activeTrigger.evaluate((button, openTriggerId) => {
        document.documentElement.removeAttribute("data-detail-expanded-at-outside-activation");
        button.addEventListener(
          "click",
          () => {
            document.documentElement.dataset.detailExpandedAtOutsideActivation =
              document.getElementById(openTriggerId)?.getAttribute("aria-expanded") ?? "missing";
          },
          { once: true }
        );
      }, switchTriggerId);
      await activeTrigger.click();
      await expect(page.locator("html")).toHaveAttribute("data-detail-expanded-at-outside-activation", "true");
      await expect(switchTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    }

    await activeCard.locator(".experience-card__summary").click();
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
    await activeTrigger.press("Enter");
    await page.getByRole("heading", { level: 1, name: "Experience" }).click();
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");

    await activeTrigger.press("Enter");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.mouse.move(0, 0);
    await settleDetailOverlayMotion(root);
    const resizedLayout = await getDetailOverlaySample(root, selectors);
    const resizedCloseSamples = sampleDetailOverlay(root, selectors);
    await activeTrigger.press("Escape");
    expectStableDetailOverlay(await resizedCloseSamples, resizedLayout);

    for (const theme of ["navy", "light", "dark"] as const) {
      await selectThemeWithChooser(page, theme);
      await activeTrigger.scrollIntoViewIfNeeded();
      await activeTrigger.click();
      await expect(panel).toHaveCSS("background-image", "none");
      await expect(panel).toHaveCSS("background-color", /^rgb\(/);
      await activeTrigger.press("Escape");
    }
  });

  test("uses only the evidence panel as the responsive overlay boundary", async ({ page }) => {
    for (const width of [981, 980]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/experience");
      await settleLayout(page);

      const cards = await expectExperienceCardsOrEmptyState(page);
      if (!cards) continue;

      const expandableIndexes = await getExpandableExperienceCardIndexes(cards);
      const cardCount = await cards.count();
      const activeIndex = expandableIndexes.find((index) => index < cardCount - 1);
      if (activeIndex === undefined) continue;

      const activeCard = cards.nth(activeIndex);
      const trigger = activeCard.locator("button.detail-section__trigger").first();
      const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
      const followingCard = cards.nth(activeIndex + 1);
      const followingTop = await followingCard.evaluate((card) => card.getBoundingClientRect().top + window.scrollY);

      await trigger.click();
      await expect(panel).toHaveCSS("position", width === 981 ? "absolute" : "static");
      const nextFollowingTop = await followingCard.evaluate((card) => card.getBoundingClientRect().top + window.scrollY);

      if (width === 981) {
        expect(Math.abs(nextFollowingTop - followingTop)).toBeLessThanOrEqual(1);
      } else {
        expect(nextFollowingTop).toBeGreaterThan(followingTop + 1);
      }
    }
  });

  test("removes evidence-panel motion in reduced-motion mode", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/experience");
    await settleLayout(page);

    const cards = await expectExperienceCardsOrEmptyState(page);
    if (!cards) return;
    const trigger = cards.locator("button.detail-section__trigger").first();
    if (!(await trigger.count())) return;
    const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);

    await trigger.click();
    expect(
      await panel.evaluate((element) => getComputedStyle(element).transitionDuration.split(",").every((value) => value.trim() === "0s"))
    ).toBe(true);
    await trigger.press("Escape");
    await expect(panel.locator("..")).toHaveAttribute("data-visual-state", "closed");
  });

  test("keeps expanded cards at rest after focus and scrolling in every palette", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/experience");
    await settleLayout(page);

    const cards = await expectExperienceCardsOrEmptyState(page);
    if (!cards) return;

    const card = await findFirstExpandableCard(cards);
    test.skip(!card, "Focus elevation regression requires an expandable Experience card.");

    await expectDisclosureFocusToKeepRestingElevation(page, card!);
  });
});
