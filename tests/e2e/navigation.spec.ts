import { expect, test, type Page } from "@playwright/test";

const mobileWidths = [320, 390, 768] as const;
const viewportHeight = 844;

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeAttached();
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

for (const width of mobileWidths) {
  test(`keeps the complete mobile dock available at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: viewportHeight });
    await openHome(page);

    const rail = page.getByRole("navigation", { name: "Mobile navigation" });
    const actions = page.locator(".blob-header__actions");

    await expectDockAtViewportBottom(page);
    await expect(page.locator(".site-brand")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("link")).toHaveCount(6);
    await expect(rail.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(rail).toHaveAttribute("data-overflow", "true");
    await expect(rail).toHaveAttribute("data-edge", "end");
    await expect(rail).toHaveCSS("overflow-x", "auto");

    for (const label of ["GitHub", "LinkedIn", "Email"]) {
      await expect(actions.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(actions.getByRole("button", { name: /choose color theme/i })).toBeVisible();
    const actionsBoxBeforeRailScroll = await actions.boundingBox();

    const horizontalGeometry = await rail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      maskImage: getComputedStyle(element).maskImage,
      scrollWidth: element.scrollWidth
    }));
    expect(horizontalGeometry.scrollWidth).toBeGreaterThan(horizontalGeometry.clientWidth);
    expect(horizontalGeometry.maskImage).toContain("linear-gradient");

    await rail.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(rail).toHaveAttribute("data-edge", "start");
    await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
    const actionsBoxAfterRailScroll = await actions.boundingBox();
    expect(Math.abs((actionsBoxAfterRailScroll?.x ?? 0) - (actionsBoxBeforeRailScroll?.x ?? 0))).toBeLessThanOrEqual(1);

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

  await page.getByRole("button", { name: /choose color theme/i }).click();
  const themeGroup = page.getByRole("group", { name: "Color theme" });
  await expect(themeGroup).toBeVisible();

  const dockBox = await page.locator(".blob-header__island").boundingBox();
  const popoverBox = await page.locator(".theme-switcher__popover").boundingBox();
  const panelBox = await page.locator(".theme-switcher__panel").boundingBox();
  expect(dockBox).not.toBeNull();
  expect(popoverBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(popoverBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(dockBox?.y ?? 0);
  expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual((dockBox?.y ?? 0) + 2);
});

test("starts idle drift and permanently stops it after direct rail interaction", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: viewportHeight });
  await openHome(page);

  const rail = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(rail).toHaveAttribute("data-overflow", "true");
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft), { timeout: 5_000 }).toBeGreaterThan(5);

  await rail.dispatchEvent("pointerdown", { pointerType: "touch" });
  await page.waitForTimeout(300);
  const lockedPosition = await rail.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(500);
  const positionAfterLock = await rail.evaluate((element) => element.scrollLeft);
  expect(Math.abs(positionAfterLock - lockedPosition)).toBeLessThanOrEqual(1);
});

test("keeps manual overflow but disables automatic drift for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: viewportHeight });
  await openHome(page);

  const rail = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(rail).toHaveAttribute("data-overflow", "true");
  await page.waitForTimeout(3_500);
  expect(await rail.evaluate((element) => element.scrollLeft)).toBe(0);

  await rail.hover();
  await page.mouse.wheel(500, 0);
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

  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(header).toHaveAttribute("data-header-state", "compact");
  await page.evaluate(() => window.scrollTo(0, 250));
  await expect(header).toHaveAttribute("data-header-state", "expanded");
});
