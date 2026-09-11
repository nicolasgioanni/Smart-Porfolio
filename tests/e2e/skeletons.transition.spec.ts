import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { siteRoutePaths, siteRoutes, type SiteRoutePath } from "../../src/components/navigation/siteRoutes";
import { prepareDarkPage, settleDocumentLayout, suppressViewportPrefetch } from "./skeletonTestHelpers";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

type HeldFlight = {
  cleanup: () => Promise<void>;
  release: () => void;
  wasHeld: () => boolean;
};

type SkeletonTransitionWindow = Window & {
  __skeletonTransitionSourceBody?: Element;
};

const nonHomeRoutePaths = siteRoutePaths.filter(
  (pathname): pathname is Exclude<SiteRoutePath, typeof siteRoutes.home> => pathname !== siteRoutes.home
);

const headerNavigationRoutes = new Set<SiteRoutePath>([
  siteRoutes.experience,
  siteRoutes.research,
  siteRoutes.projects,
  siteRoutes.recommendations,
  siteRoutes.resume
]);

function createDeferred(): Deferred {
  let resolved = false;
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: () => {
      if (resolved) return;
      resolved = true;
      resolvePromise();
    }
  };
}

async function sourceLinkFor(page: Page, pathname: Exclude<SiteRoutePath, typeof siteRoutes.home>): Promise<Locator> {
  if (headerNavigationRoutes.has(pathname)) {
    const link = page.locator(`.main-navigation a[href="${pathname}"]`);
    await expect(link, `Home navigation must expose the Next Link for ${pathname}.`).toHaveCount(1);
    return link;
  }

  const footerToggle = page.locator(".blob-footer__toggle");
  await footerToggle.scrollIntoViewIfNeeded();
  await footerToggle.click();
  const link = page.locator(`.blob-footer a[href="${pathname}"]`);
  await expect(link, `The expanded footer must expose the Next Link for ${pathname}.`).toHaveCount(1);
  return link;
}

async function holdFirstTargetFlight(page: Page, pathname: SiteRoutePath): Promise<HeldFlight> {
  const releaseFlight = createDeferred();
  let held = false;
  const handler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = request.headers();
    const isTargetNavigationFlight =
      url.pathname === pathname && headers.rsc === "1" && headers["next-router-prefetch"] !== "1";

    if (!isTargetNavigationFlight || held) {
      await route.continue();
      return;
    }

    held = true;
    await releaseFlight.promise;
    await route.continue().catch(() => undefined);
  };

  await page.route("**/*", handler);

  return {
    cleanup: async () => {
      releaseFlight.resolve();
      await page.unroute("**/*", handler);
    },
    release: releaseFlight.resolve,
    wasHeld: () => held
  };
}

async function captureSourceBody(page: Page): Promise<void> {
  await page.locator(".site-main > .page-container").evaluate((element) => {
    (window as SkeletonTransitionWindow).__skeletonTransitionSourceBody = element;
  });
}

async function expectHeldTargetRequestPreservesSourceShell(page: Page, pathname: SiteRoutePath): Promise<void> {
  await expect(page.locator(`[data-skeleton-route="${pathname}"]`)).toHaveCount(0);
  await expect(page.locator(".site-main > .page-container")).toHaveCount(1);
  await expect(page.locator(".blob-header")).toHaveCount(1);
  await expect(page.locator(".blob-footer")).toHaveCount(1);
  await expect.poll(() =>
    page.evaluate(
      () => document.querySelector(".site-main > .page-container") === (window as SkeletonTransitionWindow).__skeletonTransitionSourceBody
    )
  ).toBe(true);
}

async function expectResolvedTargetBody(page: Page): Promise<void> {
  await expect(page.locator(".site-main > .page-container")).toHaveCount(1);
  await expect.poll(() =>
    page.evaluate(
      () => document.querySelector(".site-main > .page-container") !== (window as SkeletonTransitionWindow).__skeletonTransitionSourceBody
    )
  ).toBe(true);
}

for (const pathname of nonHomeRoutePaths) {
  test(`holds the real non-prefetch RSC request for ${pathname}`, async ({ page }) => {
    await suppressViewportPrefetch(page);
    await prepareDarkPage(page, "reduce");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".site-main > .page-container")).toHaveCount(1);
    await settleDocumentLayout(page);
    await captureSourceBody(page);

    const link = await sourceLinkFor(page, pathname);
    const flight = await holdFirstTargetFlight(page, pathname);

    try {
      await link.click();
      await expect.poll(() => flight.wasHeld(), { timeout: 10_000 }).toBe(true);
      await expectHeldTargetRequestPreservesSourceShell(page, pathname);

      flight.release();
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(pathname);
      await expectResolvedTargetBody(page);
      await expect(page.locator(".blob-header")).toHaveCount(1);
      await expect(page.locator(".blob-footer")).toHaveCount(1);
    } finally {
      await flight.cleanup();
    }
  });
}
