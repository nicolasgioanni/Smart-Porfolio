import { expect, test, type Locator, type Page } from "./browserTest";
import { captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";
import { readGeneratedPortfolioContent } from "./generatedContent";
import { settleLayout } from "./settleLayout";
import { selectThemeWithChooser } from "./themePreference";
import { selectProjectDetailContent } from "../../src/lib/content/selectDetailContent";
import { getProjectActions } from "../../src/lib/projects/projectActions";
import { getProjectVisual } from "../../src/lib/projects/projectVisualRegistry";

test.beforeEach(async ({ page }) => {
  captureBrowserConsole(page);
});

test.afterEach(async ({ page }) => {
  expectNoBrowserConsoleIssues(page);
});

function getProjectCards(page: Page): Locator {
  return page.locator("article.project-card--showcase");
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function pageRelativeBox(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const pageContainer = document.querySelector(".site-main > .page-container");
    if (!pageContainer) throw new Error("Expected the project page container");
    const pageBox = pageContainer.getBoundingClientRect();
    return { height: box.height, width: box.width, x: box.x - pageBox.x, y: box.y - pageBox.y };
  });
}

async function expectDiagramLabelsContained(page: Page) {
  const cards = getProjectCards(page);
  for (let index = 0; index < await cards.count(); index += 1) {
    const tab = cards.nth(index).getByRole("tab", { name: "How it works" });
    if (await tab.count()) await tab.click();
  }

  const labels = page.locator(".project-diagram__label");
  await expect(labels).not.toHaveCount(0);
  await expect.poll(() => labels.evaluateAll((elements) => elements.every((label) => {
    const node = label.closest<HTMLElement>(".project-diagram__node");
    if (!node) return false;
    const labelBox = label.getBoundingClientRect();
    const nodeBox = node.getBoundingClientRect();
    return labelBox.width > 0 && labelBox.height > 0 &&
      label.scrollWidth <= label.clientWidth + 1 &&
      labelBox.left >= nodeBox.left - 1 &&
      labelBox.right <= nodeBox.right + 1 &&
      labelBox.top >= nodeBox.top - 1 &&
      labelBox.bottom <= nodeBox.bottom + 1;
  }))).toBe(true);
}

async function expectProjectCardsStableAcrossVisualSwitches(page: Page, viewportWidth: number) {
  const cards = getProjectCards(page);

  for (let index = 0; index < await cards.count(); index += 1) {
    const card = cards.nth(index);
    const concept = card.getByRole("tab", { name: "Concept" });
    const howItWorks = card.getByRole("tab", { name: "How it works" });
    if (!await concept.count() || !await howItWorks.count()) continue;

    await concept.click();
    const [cardBefore, titleBefore, frameBefore, actionsBefore] = await Promise.all([
      pageRelativeBox(card),
      pageRelativeBox(card.getByRole("heading")),
      pageRelativeBox(card.locator(".project-visual-tabs__panel:not([hidden])")),
      pageRelativeBox(card.locator(".project-card__actions")),
    ]);

    await howItWorks.click();
    const [cardAfter, titleAfter, frameAfter, actionsAfter] = await Promise.all([
      pageRelativeBox(card),
      pageRelativeBox(card.getByRole("heading")),
      pageRelativeBox(card.locator(".project-visual-tabs__panel:not([hidden])")),
      pageRelativeBox(card.locator(".project-card__actions")),
    ]);

    for (const [name, before, after] of [["card", cardBefore, cardAfter], ["title", titleBefore, titleAfter], ["frame", frameBefore, frameAfter], ["actions", actionsBefore, actionsAfter]] as const) {
      const message = `${name} for card ${index + 1} at ${viewportWidth}px`;
      expect(Math.abs(before.x - after.x), message).toBeLessThanOrEqual(1);
      expect(Math.abs(before.y - after.y), message).toBeLessThanOrEqual(1);
      expect(Math.abs(before.width - after.width), message).toBeLessThanOrEqual(1);
      expect(Math.abs(before.height - after.height), message).toBeLessThanOrEqual(1);
    }
  }
}

test.describe("Projects showcase", () => {
  test("renders the ordered visual cards, verified actions, and loaded concept images", async ({ page }) => {
    const projects = selectProjectDetailContent(readGeneratedPortfolioContent());

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    await expect(cards).toHaveCount(projects.length);

    for (const [index, project] of projects.entries()) {
      const card = cards.nth(index);
      const visual = getProjectVisual(project.id);
      const actions = getProjectActions(project.links);

      await expect(card.getByRole("heading", { name: project.title })).toBeVisible();
      await expect(card.getByRole("link")).toHaveCount(actions.length);
      await expect(card.getByRole("link").allTextContents()).resolves.toEqual(actions.map((action) => action.label));

      if (!visual) {
        await expect(card.locator(".project-visual-tabs")).toHaveCount(0);
        continue;
      }

      await expect(card.getByRole("tab", { name: "Concept" })).toHaveAttribute("aria-selected", "true");
      await expect(card.getByRole("tab", { name: "How it works" })).toHaveAttribute("aria-selected", "false");

      const image = card.getByRole("img", { name: visual.concept.alt });
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute("src", visual.concept.src);
      await expect(image).toHaveAttribute("width", String(visual.concept.width));
      await expect(image).toHaveAttribute("height", String(visual.concept.height));
      await expect.poll(() => image.evaluate((element) => {
        const imageElement = element as HTMLImageElement;
        return imageElement.complete && imageElement.naturalWidth === 1586 && imageElement.naturalHeight === 992;
      })).toBe(true);
    }
  });

  test("keeps each tab set independent, keyboard-operable, and inside a stable visual frame", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    const firstCard = cards.first();
    const secondCard = cards.nth(1);
    const firstTabs = firstCard.getByRole("tablist", { name: "Project visual view" });
    const concept = firstTabs.getByRole("tab", { name: "Concept" });
    const howItWorks = firstTabs.getByRole("tab", { name: "How it works" });
    const frame = firstCard.locator(".project-visual-tabs__panel").first();
    const frameBefore = await frame.boundingBox();

    await concept.focus();
    await page.keyboard.press("ArrowRight");
    await expect(howItWorks).toHaveAttribute("aria-selected", "true");
    await expect(howItWorks).toBeFocused();
    await expect(firstCard.locator(".project-diagram__label").first()).toBeVisible();
    await expect(secondCard.getByRole("tab", { name: "Concept" })).toHaveAttribute("aria-selected", "true");

    const frameAfter = await firstCard.locator(".project-visual-tabs__panel:not([hidden])").boundingBox();
    expect(frameBefore).not.toBeNull();
    expect(frameAfter).not.toBeNull();
    expect(Math.abs(frameBefore!.width - frameAfter!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(frameBefore!.height - frameAfter!.height)).toBeLessThanOrEqual(1);

    await page.keyboard.press("Home");
    await expect(concept).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(howItWorks).toHaveAttribute("aria-selected", "true");

    for (const tab of await firstTabs.getByRole("tab").all()) {
      const box = await tab.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("keeps every project card's title, visual frame, and actions fixed when switching views", async ({ page }) => {
    await page.goto("/projects");

    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await settleLayout(page);
      await expectProjectCardsStableAcrossVisualSwitches(page, width);
    }
  });

  test("uses two columns above 980px and one below, with readable mobile geometry in every theme", async ({ page }) => {
    await page.setViewportSize({ width: 981, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    const firstWide = await cards.nth(0).boundingBox();
    const secondWide = await cards.nth(1).boundingBox();
    expect(firstWide).not.toBeNull();
    expect(secondWide).not.toBeNull();
    expect(Math.abs(firstWide!.y - secondWide!.y)).toBeLessThanOrEqual(1);
    expect(secondWide!.x).toBeGreaterThan(firstWide!.x);

    await page.setViewportSize({ width: 980, height: 900 });
    await settleLayout(page);
    const firstNarrow = await cards.nth(0).boundingBox();
    const secondNarrow = await cards.nth(1).boundingBox();
    expect(firstNarrow).not.toBeNull();
    expect(secondNarrow).not.toBeNull();
    expect(secondNarrow!.y).toBeGreaterThan(firstNarrow!.y + 1);

    await page.setViewportSize({ width: 320, height: 844 });
    await cards.first().getByRole("tab", { name: "How it works" }).click();
    for (const theme of ["navy", "light", "dark"] as const) {
      await selectThemeWithChooser(page, theme);
      await expect(cards.first().locator(".project-diagram__label").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expectNoHorizontalOverflow(page);
  });

  test("keeps every diagram label inside its node at desktop, two-column, and phone widths", async ({ page }) => {
    await page.goto("/projects");

    for (const width of [1280, 1100, 981, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await settleLayout(page);
      await expectDiagramLabelsContained(page);
      await expectNoHorizontalOverflow(page);
    }
  });
});
