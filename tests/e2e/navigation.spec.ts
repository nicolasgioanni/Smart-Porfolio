import { expect, test, type Locator, type Page } from "./browserTest";
import { siteRoutePaths } from "../../src/lib/routing/siteRoutes";
import { formatProfileOverviewDateRange } from "../../src/lib/content/profileOverview";
import { selectHomeContent } from "../../src/lib/content/selectHomeContent";
import { captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";
import { readGeneratedPortfolioContent } from "./generatedContent";
import { reloadWithStoredTheme } from "./themePreference";

const mobileWidths = [320, 390, 768] as const;
const viewportHeight = 844;

test.beforeEach(async ({ page }) => {
  captureBrowserConsole(page);
});

test.afterEach(async ({ page }) => {
  expectNoBrowserConsoleIssues(page);
});

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeAttached();
}

async function scrollRailToEnd(page: Page) {
  const rail = page.locator(".mobile-navigation__rail");

  await rail.hover();
  await page.mouse.wheel(10_000, 0);
  await expect.poll(() => rail.evaluate(
    (element) => Math.abs(element.scrollWidth - element.clientWidth - element.scrollLeft)
  )).toBeLessThanOrEqual(2);
}

async function expectRailTargetReachable(rail: Locator, target: Locator) {
  await target.evaluate((element) => {
    element.scrollIntoView({ block: "nearest", inline: "center" });
  });

  await expect.poll(async () => {
    const [railBox, targetBox] = await Promise.all([rail.boundingBox(), target.boundingBox()]);
    if (!railBox || !targetBox) return false;

    return targetBox.x >= railBox.x - 1 && targetBox.x + targetBox.width <= railBox.x + railBox.width + 1;
  }).toBe(true);
}

async function expectDockAtViewportBottom(page: Page) {
  const dock = page.locator(".blob-header");
  const dockBox = await dock.boundingBox();

  expect(dockBox).not.toBeNull();
  expect(await dock.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
  const bottomGap = viewportHeight - ((dockBox?.y ?? 0) + (dockBox?.height ?? 0));
  expect(bottomGap).toBeGreaterThanOrEqual(8);
  expect(bottomGap).toBeLessThanOrEqual(20);
}

function findVisibleZeroOffsetShadow(boxShadow: string) {
  return [...boxShadow.matchAll(/rgba?\(([^)]+)\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px/g)].find((match) => {
    const channels = match[1]!.split(",").map((channel) => Number.parseFloat(channel));
    const alpha = channels.length === 4 ? channels[3]! : 1;

    return alpha > 0 && Number.parseFloat(match[2]!) === 0 && Number.parseFloat(match[3]!) === 0;
  })?.[0] ?? null;
}

async function expectDateLocationStackWithin(container: Locator, dateLine: Locator, locationLine: Locator) {
  const [containerBox, dateBox, locationBox] = await Promise.all([
    container.boundingBox(),
    dateLine.boundingBox(),
    locationLine.boundingBox()
  ]);

  expect(containerBox).not.toBeNull();
  expect(dateBox).not.toBeNull();
  expect(locationBox).not.toBeNull();
  expect(dateBox!.y + dateBox!.height).toBeLessThanOrEqual(locationBox!.y + 1);

  for (const box of [dateBox!, locationBox!]) {
    expect(box.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 1);
  }
}

async function openEducation(page: Page) {
  await page.goto("/");
  await expect(getEducationSection(page).getByRole("heading", { level: 2, name: "Education", exact: true })).toBeAttached();
}

function getEducationItem(page: Page, index: number): Locator {
  return page.locator("article.home-education-item").nth(index);
}

function getEducationSection(page: Page): Locator {
  return page.locator(".home-overview-grid .home-section").filter({
    has: page.getByRole("heading", { level: 2, name: "Education", exact: true })
  });
}

async function expectNoDocumentOverflow(page: Page) {
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  )).toBe(true);
}

async function waitForEducationDisclosureAnimations(content: Locator) {
  await expect.poll(() => content.evaluate((element) => element.getAnimations().length)).toBeGreaterThanOrEqual(2);
}

async function getEducationDisclosureMotion(content: Locator) {
  return content.evaluate(async (element) => {
    const measure = () => ({
      height: element.getBoundingClientRect().height,
      opacity: Number.parseFloat(getComputedStyle(element).opacity)
    });
    const animations = element.getAnimations();
    const started = measure();
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));

    return {
      animations: animations.map((animation) => animation.effect?.getTiming().duration),
      started,
      middle: measure(),
      targetHeight: element.scrollHeight
    };
  });
}

async function settleEducationDisclosureAnimations(content: Locator) {
  await content.evaluate(async (element) => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
  });

  await expect.poll(() => content.evaluate((element) => ({
    animationCount: element.getAnimations().length,
    height: element.style.height,
    opacity: element.style.opacity,
    overflow: element.style.overflow
  }))).toEqual({ animationCount: 0, height: "", opacity: "", overflow: "" });
}

test("stacks rendered Home date metadata above location at desktop and phone widths", async ({ page }) => {
  const homeContent = selectHomeContent(readGeneratedPortfolioContent());
  const currentWork = homeContent.profileOverview.currentWork;
  const firstExperience = homeContent.experience[0];

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: viewportHeight });
    await page.goto("/");

    const currentWorkPanel = page.locator(".profile-overview__current-work");
    const currentWorkMetadata = currentWorkPanel.locator(".profile-overview__metadata");
    const firstExperienceRole = page.locator("article.home-experience-role").first();
    const experienceDate = firstExperienceRole.locator(".home-experience-role__dates");
    const experienceLocation = firstExperienceRole.locator(".home-experience-role__location");

    await expect(currentWorkPanel).toHaveCount(currentWork ? 1 : 0);
    if (currentWork) {
      const currentWorkMetadataCount = Number(Boolean(currentWork.dateLabel)) + Number(Boolean(currentWork.location));
      const currentWorkTitle = currentWork.organization ?? currentWork.title;
      await expect(currentWorkPanel).toBeVisible();
      if (currentWorkTitle) {
        await expect(currentWorkPanel.locator(".profile-overview__entity-title")).toHaveText(currentWorkTitle);
      }
      await expect(currentWorkPanel.locator(".profile-overview__entity-subtitle")).toHaveCount(
        currentWork.organization && currentWork.title ? 1 : 0
      );
      if (currentWork.organization && currentWork.title) {
        await expect(currentWorkPanel.locator(".profile-overview__entity-subtitle")).toHaveText(currentWork.title);
      }
      await expect(currentWorkMetadata).toHaveCount(currentWorkMetadataCount);
      if (currentWork.dateLabel) await expect(currentWorkMetadata.nth(0)).toContainText(currentWork.dateLabel);
      if (currentWork.location) await expect(currentWorkMetadata.nth(currentWorkMetadataCount - 1)).toHaveText(currentWork.location);
      if (currentWork.dateLabel && currentWork.location) {
        await expectDateLocationStackWithin(currentWorkPanel, currentWorkMetadata.nth(0), currentWorkMetadata.nth(1));
      }
    }

    await expect(page.locator("article.home-experience-role")).toHaveCount(homeContent.experience.length);
    if (firstExperience) {
      const dateLabel = formatProfileOverviewDateRange(firstExperience.startDate, firstExperience.endDate);
      await expect(firstExperienceRole).toBeVisible();
      await expect(experienceDate).toHaveCount(dateLabel ? 1 : 0);
      await expect(experienceLocation).toHaveCount(firstExperience.location ? 1 : 0);
      if (dateLabel) await expect(experienceDate).toContainText(dateLabel);
      if (firstExperience.location) await expect(experienceLocation).toHaveText(firstExperience.location);
      if (dateLabel && firstExperience.location) {
        await expectDateLocationStackWithin(firstExperienceRole, experienceDate, experienceLocation);
      }
    }

    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);
  }
});

test("keeps generated Education details native, collapsed, and keyboard-operable", async ({ page }) => {
  const education = selectHomeContent(readGeneratedPortfolioContent()).education;

  await page.setViewportSize({ width: 1280, height: viewportHeight });
  await openEducation(page);

  const items = page.locator("article.home-education-item");
  await expect(items).toHaveCount(education.length);
  if (education.length === 0) {
    await expect(getEducationSection(page).getByRole("status")).toContainText(
      "Education rows will appear here when content is available."
    );
    return;
  }

  for (const [index, item] of education.entries()) {
    const educationItem = getEducationItem(page, index);
    const disclosure = educationItem.locator("details.home-education-item__disclosure");

    await expect(educationItem).toHaveCount(1);
    await expect(educationItem.locator(".home-education-item__institution")).toHaveText(item.institution);

    if (item.bullets.length === 0) {
      await expect(disclosure).toHaveCount(0);
      continue;
    }

    const summary = disclosure.locator("summary.home-education-item__disclosure-summary");
    const showMore = summary.locator(".home-education-item__disclosure-label-more");
    const showLess = summary.locator(".home-education-item__disclosure-label-less");
    const details = disclosure.getByRole("list", { name: `${item.institution} education details`, includeHidden: true });
    await expect(disclosure).toHaveCount(1);
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(showMore).toBeVisible();
    await expect(showLess).toBeHidden();
    await expect(summary).toHaveAccessibleName("Show more");
    await expect(details).toHaveCount(1);
    await expect(details).toBeHidden();
    await expect(details.locator("li")).toHaveCount(item.bullets.length);
    await expect(details.locator("li")).toHaveText(item.bullets);
    expect(await educationItem.evaluate((element) => {
      const disclosureElement = element.querySelector("details.home-education-item__disclosure");
      const metadata = element.querySelectorAll(
        ".home-education-item__program, .home-education-item__concentration, .home-education-item__dates, .home-education-item__location"
      );

      return Boolean(disclosureElement) && Array.from(metadata).every((line) =>
        Boolean(line.compareDocumentPosition(disclosureElement!) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    })).toBe(true);

    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(showMore).toBeHidden();
    await expect(showLess).toBeVisible();
    await expect(summary).toHaveAccessibleName("Show less");
    await expect(details).toBeVisible();

    await page.keyboard.press("Space");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(showMore).toBeVisible();
  }
});

test("keeps Education disclosure growth in flow without overflow at its responsive widths", async ({ page }) => {
  const education = selectHomeContent(readGeneratedPortfolioContent()).education
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => item.bullets.length > 0);

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: viewportHeight });
    await openEducation(page);

    if (education.length === 0) {
      await expect(getEducationSection(page).getByRole("status")).toContainText(
        "Education rows will appear here when content is available."
      );
      await expectNoDocumentOverflow(page);
      continue;
    }

    for (const { index, item } of education) {
      const educationItem = getEducationItem(page, index);
      const disclosure = educationItem.locator("details.home-education-item__disclosure");
      const summary = disclosure.locator("summary.home-education-item__disclosure-summary");
      const content = disclosure.locator(".home-education-item__disclosure-content");
      const details = disclosure.getByRole("list", { name: `${item.institution} education details`, includeHidden: true });

      await summary.scrollIntoViewIfNeeded();
      const [itemBoxBefore, summaryBox] = await Promise.all([educationItem.boundingBox(), summary.boundingBox()]);
      expect(itemBoxBefore).not.toBeNull();
      expect(summaryBox).not.toBeNull();
      expect(summaryBox!.width).toBeGreaterThanOrEqual(44);
      expect(summaryBox!.height).toBeGreaterThanOrEqual(44);

      await summary.click();
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(details).toBeVisible();
      await settleEducationDisclosureAnimations(content);

      const [itemBoxAfter, contentBox, detailsBox] = await Promise.all([
        educationItem.boundingBox(),
        content.boundingBox(),
        details.boundingBox()
      ]);
      expect(itemBoxAfter).not.toBeNull();
      expect(contentBox).not.toBeNull();
      expect(detailsBox).not.toBeNull();
      expect(itemBoxAfter!.height).toBeGreaterThan(itemBoxBefore!.height);
      expect(contentBox!.y).toBeGreaterThanOrEqual(summaryBox!.y + summaryBox!.height - 1);
      expect(detailsBox!.x).toBeGreaterThanOrEqual(itemBoxAfter!.x - 1);
      expect(detailsBox!.x + detailsBox!.width).toBeLessThanOrEqual(itemBoxAfter!.x + itemBoxAfter!.width + 1);
      await expectNoDocumentOverflow(page);
    }
  }
});

test("uses semantic Education summary hover and focus states in every palette", async ({ page }) => {
  const firstDetailedEducationIndex = selectHomeContent(readGeneratedPortfolioContent()).education.findIndex(
    (item) => item.bullets.length > 0
  );
  test.skip(firstDetailedEducationIndex < 0, "Education interaction coverage requires a generated item with details.");

  await page.setViewportSize({ width: 1280, height: viewportHeight });
  await openEducation(page);

  for (const theme of ["navy", "light", "dark"] as const) {
    await reloadWithStoredTheme(page, theme);
    const summary = getEducationItem(page, firstDetailedEducationIndex)
      .locator("summary.home-education-item__disclosure-summary");

    const idle = await summary.evaluate((element) => ({
      color: getComputedStyle(element).color,
      layerOpacity: getComputedStyle(element, "::before").opacity
    }));
    await summary.scrollIntoViewIfNeeded();
    const summaryBox = await summary.boundingBox();
    expect(summaryBox).not.toBeNull();
    await page.mouse.move(summaryBox!.x + summaryBox!.width / 2, summaryBox!.y + summaryBox!.height / 2);
    await expect.poll(() => summary.evaluate((element) => ({
      color: getComputedStyle(element).color,
      hoverMedia: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
      isHovered: element.matches(":hover"),
      layerColor: getComputedStyle(element, "::before").backgroundColor,
      layerOpacity: getComputedStyle(element, "::before").opacity,
      shadow: getComputedStyle(element).boxShadow
    }))).toMatchObject({ hoverMedia: true, isHovered: true, layerOpacity: "1" });
    const hoveredStyle = await summary.evaluate((element) => ({
      color: getComputedStyle(element).color,
      layerColor: getComputedStyle(element, "::before").backgroundColor,
      layerOpacity: getComputedStyle(element, "::before").opacity,
      shadow: getComputedStyle(element).boxShadow
    }));
    expect(hoveredStyle.layerOpacity).not.toBe(idle.layerOpacity);
    expect(hoveredStyle.layerColor).toMatch(/^rgb\(/);
    expect(hoveredStyle.shadow).not.toBe("none");

    await page.mouse.move(0, 0);
    await expect.poll(() => summary.evaluate((element) => getComputedStyle(element, "::before").opacity)).toBe("0");
    await summary.focus();
    await expect.poll(() => summary.evaluate((element) => getComputedStyle(element, "::before").opacity)).toBe("1");
    const focused = await summary.evaluate((element) => ({
      color: getComputedStyle(element).color,
      layerOpacity: getComputedStyle(element, "::before").opacity,
      shadow: getComputedStyle(element).boxShadow
    }));
    expect(focused.layerOpacity).not.toBe(idle.layerOpacity);
    expect(focused.shadow).not.toBe("none");
    expect(focused.color).not.toBe(idle.color);
  }
});

test("progresses and reverses Education disclosure animation without clipping its final state", async ({ page }) => {
  const firstDetailedEducation = selectHomeContent(readGeneratedPortfolioContent()).education.find((item) => item.bullets.length > 0);
  const firstDetailedEducationIndex = selectHomeContent(readGeneratedPortfolioContent()).education.findIndex(
    (item) => item.bullets.length > 0
  );
  test.skip(firstDetailedEducationIndex < 0, "Education motion coverage requires a generated item with details.");

  await page.setViewportSize({ width: 390, height: viewportHeight });
  await openEducation(page);

  const disclosure = getEducationItem(page, firstDetailedEducationIndex)
    .locator("details.home-education-item__disclosure");
  const summary = disclosure.locator("summary.home-education-item__disclosure-summary");
  const showLess = summary.locator(".home-education-item__disclosure-label-less");
  const content = disclosure.locator(".home-education-item__disclosure-content");
  const details = disclosure.getByRole("list", { name: `${firstDetailedEducation!.institution} education details`, includeHidden: true });

  await summary.scrollIntoViewIfNeeded();
  await summary.click();
  await expect(disclosure).toHaveAttribute("open", "");
  await waitForEducationDisclosureAnimations(content);
  const opening = await getEducationDisclosureMotion(content);
  expect(opening.animations).toEqual(expect.arrayContaining([expect.any(Number), expect.any(Number)]));
  expect(opening.animations.every((duration) => Number(duration) > 0)).toBe(true);
  expect(opening.middle.height).toBeGreaterThan(opening.started.height);
  expect(opening.middle.height).toBeLessThan(opening.targetHeight);
  expect(opening.middle.opacity).toBeGreaterThan(opening.started.opacity);

  await summary.click();
  await waitForEducationDisclosureAnimations(content);
  await page.waitForTimeout(90);
  const closingHeight = await content.evaluate((element) => element.getBoundingClientRect().height);
  expect(closingHeight).toBeGreaterThan(0);
  expect(closingHeight).toBeLessThan(opening.targetHeight);

  await summary.click();
  await expect(showLess).toBeVisible();
  const reopeningHeight = await content.evaluate((element) => element.getBoundingClientRect().height);
  expect(reopeningHeight).toBeGreaterThan(0);
  await settleEducationDisclosureAnimations(content);
  await expect(details).toBeVisible();
  await expect.poll(() => content.evaluate((element) => ({
    height: element.style.height,
    opacity: element.style.opacity,
    overflow: element.style.overflow
  }))).toEqual({ height: "", opacity: "", overflow: "" });

  await summary.click();
  await settleEducationDisclosureAnimations(content);
  await summary.click();
  await waitForEducationDisclosureAnimations(content);
  const narrowInnerHeight = (await content.locator(".home-education-item__disclosure-measure").boundingBox())?.height ?? 0;
  await page.setViewportSize({ width: 1280, height: viewportHeight });
  await settleEducationDisclosureAnimations(content);
  const widenedContent = await content.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    innerHeight: element.querySelector<HTMLElement>(".home-education-item__disclosure-measure")?.getBoundingClientRect().height
  }));
  const wideInnerHeight = (await content.locator(".home-education-item__disclosure-measure").boundingBox())?.height ?? 0;
  expect(narrowInnerHeight).toBeGreaterThanOrEqual(wideInnerHeight);
  expect(widenedContent.height).toBeGreaterThan(0);
  expect(widenedContent.innerHeight).not.toBeUndefined();
  expect(Math.abs(widenedContent.height - widenedContent.innerHeight!)).toBeLessThanOrEqual(1);
  await expectNoDocumentOverflow(page);
});

test("expands Education details immediately when reduced motion is requested", async ({ page }) => {
  const firstDetailedEducation = selectHomeContent(readGeneratedPortfolioContent()).education.find((item) => item.bullets.length > 0);
  const firstDetailedEducationIndex = selectHomeContent(readGeneratedPortfolioContent()).education.findIndex(
    (item) => item.bullets.length > 0
  );
  test.skip(firstDetailedEducationIndex < 0, "Education reduced-motion coverage requires a generated item with details.");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: viewportHeight });
  await openEducation(page);

  const disclosure = getEducationItem(page, firstDetailedEducationIndex)
    .locator("details.home-education-item__disclosure");
  const summary = disclosure.locator("summary.home-education-item__disclosure-summary");
  const content = disclosure.locator(".home-education-item__disclosure-content");
  const details = disclosure.getByRole("list", { name: `${firstDetailedEducation!.institution} education details`, includeHidden: true });

  await expect(summary).toHaveCSS("transition-duration", "0s");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(details).toBeVisible();
  await expect.poll(() => content.evaluate((element) => ({
    animationCount: element.getAnimations().length,
    height: element.style.height,
    opacity: element.style.opacity,
    overflow: element.style.overflow
  }))).toEqual({ animationCount: 0, height: "", opacity: "", overflow: "" });
  await expectNoDocumentOverflow(page);
});

for (const width of mobileWidths) {
  test(`keeps the complete mobile dock available without automatic motion at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: viewportHeight });
    await openHome(page);

    const rail = page.locator(".mobile-navigation__rail");
    const routes = page.getByRole("navigation", { name: "Mobile navigation" });
    const actions = rail.locator(".blob-header__actions");

    await expectDockAtViewportBottom(page);
    await expect(page.locator(".site-brand")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();
    await expect(rail).toBeVisible();
    await expect(routes).toBeVisible();
    await expect(routes.getByRole("link")).toHaveCount(6);
    await expect(routes.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(actions).toHaveCount(1);
    await expect(rail).toHaveAttribute("data-overflow", "true");
    await expect(rail).toHaveAttribute("data-edge", "end");
    await expect(rail).not.toHaveAttribute("data-automating", "");
    await expect(rail).toHaveCSS("overflow-x", "auto");

    const railBox = await rail.boundingBox();
    expect(railBox).not.toBeNull();
    expect(railBox?.x ?? Number.NEGATIVE_INFINITY).toBeGreaterThanOrEqual(0);
    expect((railBox?.x ?? 0) + (railBox?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(width);

    const actionsBoxBeforeRailScroll = await actions.boundingBox();

    const horizontalGeometry = await rail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      maskImage: getComputedStyle(element).maskImage,
      scrollWidth: element.scrollWidth
    }));
    expect(horizontalGeometry.scrollWidth).toBeGreaterThan(horizontalGeometry.clientWidth);
    expect(horizontalGeometry.maskImage).toBe("none");

    for (const target of [
      routes.getByRole("link", { name: "Recommendations", exact: true }),
      routes.getByRole("link", { name: "Resume", exact: true }),
      actions.getByRole("button", { name: /choose color theme/i })
    ]) {
      await expectRailTargetReachable(rail, target);
    }

    await scrollRailToEnd(page);
    await expect(rail).toHaveAttribute("data-edge", "start");
    await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).maskImage)).toBe("none");
    const actionsBoxAfterRailScroll = await actions.boundingBox();
    const railScrollDistance = await rail.evaluate((element) => element.scrollLeft);
    expect(railScrollDistance).toBeGreaterThan(1);
    expect(Math.abs(
      (actionsBoxBeforeRailScroll?.x ?? 0) - (actionsBoxAfterRailScroll?.x ?? 0) - railScrollDistance
    )).toBeLessThanOrEqual(2);

    for (const label of ["GitHub", "LinkedIn", "Email"]) {
      await expect(actions.getByRole("link", { name: label, exact: true })).toBeInViewport();
    }
    await expect(actions.getByRole("button", { name: /choose color theme/i })).toBeInViewport();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expectDockAtViewportBottom(page);

    const dockBox = await page.locator(".blob-header").boundingBox();
    const footerBox = await page.locator(".blob-footer").boundingBox();
    const pageBottomClearance = await page.locator(".site-shell").evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).paddingBottom)
    );
    expect(pageBottomClearance).toBeGreaterThanOrEqual((dockBox?.height ?? 0) + 10);
    expect((footerBox?.y ?? 0) + (footerBox?.height ?? 0)).toBeLessThanOrEqual(dockBox?.y ?? 0);

    const documentGeometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(documentGeometry.scrollWidth).toBeLessThanOrEqual(documentGeometry.clientWidth + 1);
  });
}

test("opens the mobile theme chooser above the dock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: viewportHeight });
  await openHome(page);

  await scrollRailToEnd(page);
  await page.getByRole("button", { name: /choose color theme/i }).click();
  const themeGroup = page.getByRole("group", { name: "Color theme preference" });
  await expect(themeGroup).toBeVisible();

  const dockBox = await page.locator(".blob-header__island").boundingBox();
  const portal = page.locator("body > .theme-switcher__popover--portal");
  const popoverBox = await portal.boundingBox();
  const panelBox = await page.locator(".theme-switcher__panel").boundingBox();
  await expect(portal).toHaveCSS("position", "fixed");
  expect(dockBox).not.toBeNull();
  expect(popoverBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(popoverBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(dockBox?.y ?? 0);
  expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual((dockBox?.y ?? 0) + 2);
});

test("follows the system color scheme until a visitor chooses an override", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => window.localStorage.removeItem("portfolio-theme"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const root = page.locator("html");
  const trigger = page.getByRole("button", { name: /choose color theme/i });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await trigger.click();

  const group = page.getByRole("group", { name: "Color theme preference" });
  const systemOption = group.getByRole("button", { name: /^System, follows device setting/ });
  await expect(systemOption).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(trigger).toHaveAccessibleName("Choose color theme. Current setting: System; using Dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(trigger).toHaveAccessibleName("Choose color theme. Current setting: System; using Light");

  const myModeOption = group.getByRole("button", { name: "My mode", exact: true });
  await myModeOption.focus();
  await myModeOption.press("Enter");
  await expect(root).toHaveAttribute("data-theme", "navy");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("portfolio-theme"))).toBe("navy");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "navy");

  await systemOption.click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("portfolio-theme"))).toBeNull();

  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
});

test("keeps rapid hydrated palette changes focused, interruption-safe, and reduced-motion safe", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, "startViewTransition", {
      configurable: true,
      value(update: () => void) {
        document.documentElement.dataset.themeTransitionCount = String(
          Number(document.documentElement.dataset.themeTransitionCount ?? "0") + 1
        );
        update();
        return { finished: Promise.reject(new Error("Theme transition interrupted")) };
      }
    });
  });
  await page.addInitScript(() => window.localStorage.removeItem("portfolio-theme"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const root = page.locator("html");
  const trigger = page.getByRole("button", { name: /choose color theme/i });
  await expect(root).not.toHaveAttribute("data-theme-transition-count");
  await trigger.click();

  const group = page.getByRole("group", { name: "Color theme preference" });
  await group.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveAttribute("data-theme-transition-count", "1");
  await group.getByRole("button", { name: "Light", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveAttribute("data-theme-transition-count", "2");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(group).toBeVisible();
  await page.waitForTimeout(0);
  expect(pageErrors).toEqual([]);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await group.getByRole("button", { name: "My mode", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "navy");
  await expect(root).toHaveAttribute("data-theme-transition-count", "2");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("keeps native outside dismissal available during a palette transition", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.removeItem("portfolio-theme"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const root = page.locator("html");
  const trigger = page.getByRole("button", { name: /choose color theme/i });
  await trigger.click();
  const group = page.getByRole("group", { name: "Color theme preference" });

  await group.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await root.dispatchEvent("pointerdown", { pointerType: "mouse" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("uses solid, layered semantic surfaces in every palette", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  for (const theme of ["navy", "light", "dark"] as const) {
    await reloadWithStoredTheme(page, theme);
    const surfaces = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing representative surface: ${selector}`);

        const styles = getComputedStyle(element);
        return {
          backgroundColor: styles.backgroundColor,
          backgroundImage: styles.backgroundImage,
          boxShadow: styles.boxShadow
        };
      };

      return {
        page: read("body"),
        header: read(".glass-blob--nav"),
        module: read(".home-section__surface"),
        control: read(".theme-switcher__trigger")
      };
    });

    for (const surface of Object.values(surfaces)) {
      expect(surface.backgroundImage).toBe("none");
      expect(surface.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(findVisibleZeroOffsetShadow(surface.boxShadow)).toBeNull();
    }

    expect(surfaces.header.backgroundColor).not.toBe(surfaces.page.backgroundColor);
    expect(surfaces.module.backgroundColor).not.toBe(surfaces.page.backgroundColor);
  }
});

test("moves the whole rail immediately, pauses after touch, and resumes in place after five seconds", async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: viewportHeight });
  await openHome(page);

  const rail = page.locator(".mobile-navigation__rail");
  await expect(rail).toHaveAttribute("data-overflow", "true");
  const driftBaseline = await rail.evaluate((element) => {
    const actionsElement = element.querySelector<HTMLElement>(".blob-header__actions");
    if (!actionsElement) throw new Error("The mobile rail is missing its action cluster.");

    return {
      actionsX: actionsElement.getBoundingClientRect().x,
      scrollLeft: element.scrollLeft
    };
  });
  await page.clock.runFor(500);
  const driftedRail = await rail.evaluate((element) => {
    const actionsElement = element.querySelector<HTMLElement>(".blob-header__actions");
    if (!actionsElement) throw new Error("The mobile rail is missing its action cluster.");

    return {
      actionsX: actionsElement.getBoundingClientRect().x,
      scrollLeft: element.scrollLeft
    };
  });
  const driftDistance = driftedRail.scrollLeft - driftBaseline.scrollLeft;
  expect(driftDistance).toBeGreaterThan(5);
  expect(Math.abs(driftBaseline.actionsX - driftedRail.actionsX - driftDistance)).toBeLessThanOrEqual(2);

  await rail.evaluate((element) => {
    element.scrollLeft = Math.min(140, (element.scrollWidth - element.clientWidth) / 2);
    element.dispatchEvent(new Event("scroll"));
  });
  await rail.dispatchEvent("pointerdown", { pointerType: "touch" });
  await rail.dispatchEvent("pointerup", { pointerType: "touch" });
  await expect(rail).not.toHaveAttribute("data-automating", "");
  const pausedPosition = await rail.evaluate((element) => element.scrollLeft);

  await page.clock.runFor(2_500);
  const positionBeforeResume = await rail.evaluate((element) => element.scrollLeft);
  expect(Math.abs(positionBeforeResume - pausedPosition)).toBeLessThanOrEqual(1);
  expect(positionBeforeResume).toBeGreaterThan(40);

  await page.clock.runFor(2_400);
  await expect(rail).not.toHaveAttribute("data-automating", "");
  expect(Math.abs(await rail.evaluate((element) => element.scrollLeft) - pausedPosition)).toBeLessThanOrEqual(1);

  await page.clock.runFor(100);
  await expect(rail).toHaveAttribute("data-automating", "");
  await page.clock.runFor(200);
  const resumedPosition = await rail.evaluate((element) => element.scrollLeft);
  expect(Math.abs(resumedPosition - pausedPosition)).toBeGreaterThan(3);
  expect(resumedPosition).toBeGreaterThan(30);
});

for (const width of [320, 390, 720]) {
  test(`keeps Home concise with one skill row per group at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: viewportHeight });
    await openHome(page);

    for (const card of await page.locator(".home-research-card, .home-project-card").all()) {
      await expect(card.locator(".home-card-summary__full")).toBeHidden();
      const summary = card.locator(".home-card-summary__mobile");
      if (await summary.count()) {
        await expect(summary).toBeVisible();
        const text = (await summary.innerText()).trim();
        expect(Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(text))).toHaveLength(1);
        expect(await summary.evaluate((element) => {
          const bounds = element.closest("article")!.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return Array.from(range.getClientRects()).every((rect) => rect.left >= bounds.left && rect.right <= bounds.right);
        })).toBe(true);
      }
      await expect(card.locator(".home-project-card__skills")).toBeHidden();
    }
    await expect(page.locator(".home-research-card__date, .home-research-card__location")).toHaveCount(0);

    for (const group of await page.locator(".skills-group--compact").all()) {
      const geometry = await group.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return Array.from(element.querySelectorAll<HTMLElement>(".portfolio-skill-showcase__item")).map((item) => {
          const rect = item.getBoundingClientRect();
          return { top: rect.top, left: rect.left - bounds.left, right: bounds.right - rect.right,
            fits: item.scrollWidth <= item.clientWidth + 1 };
        });
      });
      expect(geometry.length).toBeGreaterThan(0);
      expect(new Set(geometry.map(({ top }) => Math.round(top))).size).toBe(1);
      for (const item of geometry) {
        expect(item.left).toBeGreaterThanOrEqual(0);
        expect(item.right).toBeGreaterThanOrEqual(0);
        expect(item.fits).toBe(true);
      }
    }
    const skill = page.locator(".skills-group--compact button").first();
    if (await skill.count()) {
      await skill.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(skill).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("uses a compact intermediate Home layout without overflow or dock overlap", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [721, 860, 980]) {
    await page.setViewportSize({ width, height: viewportHeight });
    await page.goto("/");

    const hero = page.locator(".profile-overview__shell");
    const identity = hero.locator(".profile-overview__identity-list");
    await expect(hero).toBeVisible();

    const geometry = await hero.evaluate((element) => {
      const read = (selector: string) => {
        const target = element.querySelector<HTMLElement>(selector);
        if (!target) throw new Error(`Missing ${selector}`);
        const rect = target.getBoundingClientRect();
        return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
      };
      const shell = element.getBoundingClientRect();
      const introduction = read(".profile-overview__introduction");
      const profile = read(".profile-overview__photo-column");
      const details = read(".profile-overview__details");
      const portrait = read(".profile-overview__portrait-column");
      const identity = read(".profile-overview__identity-list");
      return {
        detailsAfterProfile: details.top >= profile.bottom - 1,
        identityBesidePortrait: identity.left >= portrait.right - 1 && identity.top <= portrait.bottom,
        introductionBeforeProfile: introduction.bottom <= profile.top + 1,
        profileWithinShell: profile.left >= shell.left - 1 && profile.right <= shell.right + 1
      };
    });

    expect(geometry.introductionBeforeProfile).toBe(true);
    expect(geometry.identityBesidePortrait).toBe(true);
    expect(geometry.detailsAfterProfile).toBe(true);
    expect(geometry.profileWithinShell).toBe(true);
    for (const item of await identity.locator(".profile-overview__identity-link, .profile-overview__identity-static").all()) {
      await expect(item).toHaveCSS("min-height", "44px");
    }
    const sectionGeometry = await page.locator(".home-section").evaluateAll((sections) =>
      sections.map((section) => {
        const rect = section.getBoundingClientRect();
        return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
      })
    );
    expect(sectionGeometry.length).toBeGreaterThan(0);
    for (const [index, section] of sectionGeometry.entries()) {
      expect(section.left).toBeGreaterThanOrEqual(-1);
      expect(section.right).toBeLessThanOrEqual(width + 1);
      if (index > 0) expect(section.top).toBeGreaterThanOrEqual(sectionGeometry[index - 1]!.bottom - 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expectDockAtViewportBottom(page);
    const [lastSectionBox, dockBox] = await Promise.all([
      page.locator(".home-section").last().boundingBox(),
      page.locator(".blob-header").boundingBox()
    ]);
    expect(lastSectionBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    expect((lastSectionBox?.y ?? 0) + (lastSectionBox?.height ?? 0)).toBeLessThanOrEqual(dockBox?.y ?? 0);
  }
});

test("uses concise Home summaries and hides project skills through 860px", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [721, 860]) {
    await page.setViewportSize({ width, height: viewportHeight });
    await page.goto("/");
    for (const summary of await page.locator(".home-card-summary__full").all()) await expect(summary).toBeHidden();
    for (const summary of await page.locator(".home-card-summary__mobile").all()) await expect(summary).toBeVisible();
    for (const skills of await page.locator(".home-project-card__skills").all()) await expect(skills).toBeHidden();
  }

  await page.setViewportSize({ width: 861, height: viewportHeight });
  await page.goto("/");
  for (const summary of await page.locator(".home-card-summary__full").all()) await expect(summary).toBeVisible();
  for (const summary of await page.locator(".home-card-summary__mobile").all()) await expect(summary).toBeHidden();
  for (const skills of await page.locator(".home-project-card__skills").all()) await expect(skills).toBeVisible();
});

test("preserves desktop Home summaries and project skills above the intermediate breakpoint", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [861, 981, 1280]) {
    await page.setViewportSize({ width, height: viewportHeight });
    await page.goto("/");
    await expect(page.locator(".page-container--home")).toBeVisible();
    for (const summary of await page.locator(".home-card-summary__full").all()) await expect(summary).toBeVisible();
    for (const summary of await page.locator(".home-card-summary__mobile").all()) await expect(summary).toBeHidden();
    for (const skills of await page.locator(".home-project-card__skills").all()) await expect(skills).toBeVisible();
    await expect(page.locator(".home-research-card__date, .home-research-card__location")).toHaveCount(0);
  }
});

test("reveals mobile recommendations after exactly the first sentence on Home and Recommendations", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Intl, "Segmenter", { configurable: true, value: undefined });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: viewportHeight });
  for (const route of ["/", "/recommendations"]) {
    await page.goto(route);
    const quotes = page.locator('.recommendation-expandable[data-has-more-sentences="true"]');
    for (const root of await quotes.all()) {
      const quote = root.locator("blockquote");
      const full = (await quote.textContent())!;
      const first = new Intl.Segmenter("en", { granularity: "sentence" }).segment(full)[Symbol.iterator]().next().value!.segment.trim();
      await expect(quote).toHaveText(full);
      expect((await quote.innerText()).trim()).toBe(first);
      await expect(root.locator(".recommendation-expandable__remainder")).toBeHidden();
      const toggle = root.locator(".recommendation-expandable__toggle");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect((await quote.innerText()).trim()).toBe(full.trim());
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      expect((await quote.innerText()).trim()).toBe(first);
    }
  }
});

test("keeps manual overflow but disables automatic drift for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: viewportHeight });
  await openHome(page);

  const rail = page.locator(".mobile-navigation__rail");
  await expect(rail).toHaveAttribute("data-overflow", "true");
  await page.waitForTimeout(3_500);
  expect(await rail.evaluate((element) => element.scrollLeft)).toBe(0);
  await expect(rail).not.toHaveAttribute("data-automating", "");

  await scrollRailToEnd(page);
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test("preserves the desktop top header, brand, routes, and compact scroll state", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const header = page.locator(".blob-header");
  const mainNavigation = page.getByRole("navigation", { name: "Main navigation" });

  await expect(header).toHaveCSS("position", "sticky");
  await expect(header).toHaveAttribute("data-header-state", "expanded");
  await expect(page.locator(".site-brand")).toBeVisible();
  await expect(page.locator(".site-brand__name")).toContainText("Nicolas");
  await expect(mainNavigation).toBeVisible();
  await expect(mainNavigation.getByRole("link")).toHaveCount(6);
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeHidden();
  await expect(page.locator(".mobile-navigation")).toHaveCSS("display", "contents");
  await expect(page.locator(".mobile-navigation .blob-header__actions")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(header).toHaveAttribute("data-header-state", "compact");
  await page.evaluate(() => window.scrollTo(0, 250));
  await expect(header).toHaveAttribute("data-header-state", "expanded");
});

for (const pathname of siteRoutePaths) {
  test(`animates the resolved body on ${pathname} without including the shared shell`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(pathname);

    const pageBody = page.locator(".site-main > .page-container");
    await expect(pageBody).toHaveCount(1);
    await expect(pageBody).toHaveCSS("animation-name", "page-body-enter");
    await expect(page.locator(".site-main > .skeleton-page")).toHaveCount(0);
    await expect(page.locator(".blob-header")).not.toHaveCSS("animation-name", "page-body-enter");
    await expect(page.locator(".blob-footer")).not.toHaveCSS("animation-name", "page-body-enter");
  });
}

test("restarts page entry motion after client-side navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-scroll-behavior", "smooth");
  await page.evaluate(() => {
    const rootElement = document.documentElement;
    rootElement.style.scrollBehavior = "smooth";
    const scrollBehaviorChanges: string[] = [];

    new MutationObserver((records) => {
      for (const record of records) scrollBehaviorChanges.push(record.oldValue ?? "");
    }).observe(rootElement, { attributeFilter: ["style"], attributeOldValue: true, attributes: true });

    (window as Window & { __scrollBehaviorChanges?: string[] }).__scrollBehaviorChanges = scrollBehaviorChanges;
  });

  const initialPageBody = page.locator(".site-main > .page-container");
  await expect(initialPageBody).toHaveCSS("animation-name", "page-body-enter");
  await initialPageBody.evaluate((element) => {
    const navigationWindow = window as Window & {
      __initialPageBody?: Element;
      __pageEntryDocumentMarker?: string;
    };
    navigationWindow.__initialPageBody = element;
    navigationWindow.__pageEntryDocumentMarker = "same-document";
  });

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/projects");

  const nextPageBody = page.locator(".site-main > .page-container");
  await expect(nextPageBody).toHaveCSS("animation-name", "page-body-enter");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  const navigationResult = await nextPageBody.evaluate((element) => {
    const navigationWindow = window as Window & {
      __initialPageBody?: Element;
      __pageEntryDocumentMarker?: string;
    };

    return {
      replacedPageBody: navigationWindow.__initialPageBody !== element,
      sameDocument: navigationWindow.__pageEntryDocumentMarker === "same-document"
    };
  });
  expect(navigationResult.sameDocument).toBe(true);
  expect(navigationResult.replacedPageBody).toBe(true);
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __scrollBehaviorChanges?: string[] }).__scrollBehaviorChanges ?? []
  )).toContain("scroll-behavior: auto;");
  await expect(root).toHaveAttribute("style", "scroll-behavior: smooth;");
});

test("shows page content immediately when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const pageBody = page.locator(".site-main > .page-container");
  await expect(pageBody).toHaveCSS("animation-name", "none");
  await expect(pageBody).toHaveCSS("opacity", "1");
  await expect(pageBody).toHaveCSS("transform", "none");
});
