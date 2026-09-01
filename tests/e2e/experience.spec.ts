import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectDisclosureFocusToKeepRestingElevation,
  findFirstExpandableCard
} from "./cardFocusElevation";
import { captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";

test.beforeEach(async ({ page }) => {
  captureBrowserConsole(page);
});

test.afterEach(async ({ page }) => {
  expectNoBrowserConsoleIssues(page);
});

async function settleLayout(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  });
}

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

    await secondDisclosure.click();
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
