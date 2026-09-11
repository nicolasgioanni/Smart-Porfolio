import { expect, test, type Page } from "@playwright/test";
import { siteRoutePaths } from "../../src/components/navigation/siteRoutes";

const mobileWidths = [320, 390, 768] as const;
const viewportHeight = 844;

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
    await expect(rail).toHaveCSS("overflow-x", "auto");

    const actionsBoxBeforeRailScroll = await actions.boundingBox();

    const horizontalGeometry = await rail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      maskImage: getComputedStyle(element).maskImage,
      scrollWidth: element.scrollWidth
    }));
    expect(horizontalGeometry.scrollWidth).toBeGreaterThan(horizontalGeometry.clientWidth);
    expect(horizontalGeometry.maskImage).toContain("linear-gradient");

    await scrollRailToEnd(page);
    await expect(rail).toHaveAttribute("data-edge", "start");
    await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
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

  await group.getByRole("button", { name: "My mode", exact: true }).click();
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

test("moves the whole rail, pauses after touch, and resumes in place after five seconds", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: viewportHeight });
  await openHome(page);

  const rail = page.locator(".mobile-navigation__rail");
  const actions = rail.locator(".blob-header__actions");
  await expect(rail).toHaveAttribute("data-overflow", "true");
  const actionsStartX = (await actions.boundingBox())?.x ?? 0;
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft), { timeout: 5_000 }).toBeGreaterThan(5);
  const actionsDriftingX = (await actions.boundingBox())?.x ?? 0;
  expect(actionsStartX - actionsDriftingX).toBeGreaterThan(4);

  await rail.evaluate((element) => {
    element.scrollLeft = Math.min(140, (element.scrollWidth - element.clientWidth) / 2);
    element.dispatchEvent(new Event("scroll"));
  });
  await rail.dispatchEvent("pointerdown", { pointerType: "touch" });
  await rail.dispatchEvent("pointerup", { pointerType: "touch" });
  await expect(rail).not.toHaveAttribute("data-automating", "");
  const pausedPosition = await rail.evaluate((element) => element.scrollLeft);

  await page.waitForTimeout(4_600);
  const positionBeforeResume = await rail.evaluate((element) => element.scrollLeft);
  expect(Math.abs(positionBeforeResume - pausedPosition)).toBeLessThanOrEqual(1);
  expect(positionBeforeResume).toBeGreaterThan(40);

  await expect(rail).toHaveAttribute("data-automating", "", { timeout: 1_500 });
  await expect.poll(
    () => rail.evaluate((element, start) => Math.abs(element.scrollLeft - start), pausedPosition),
    { timeout: 2_000 }
  ).toBeGreaterThan(3);
  expect(await rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(30);
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
});

test("shows page content immediately when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const pageBody = page.locator(".site-main > .page-container");
  await expect(pageBody).toHaveCSS("animation-name", "none");
  await expect(pageBody).toHaveCSS("opacity", "1");
  await expect(pageBody).toHaveCSS("transform", "none");
});
