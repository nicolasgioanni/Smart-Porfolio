import { expect, test, type Locator, type Page, type Request, type Response } from "./browserTest";
import { siteRoutePaths, siteRoutes, type SiteRoutePath } from "../../src/lib/routing/siteRoutes";
import { captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";
import { skeletonMarkupByRoute } from "./skeletonMarkup";
import { prepareDarkPage, settleDocumentLayout } from "./skeletonTestHelpers";
import {
  collectStandaloneDocumentSource,
  createStandaloneDocument,
  waitForStandaloneDocumentAssets
} from "./standaloneSkeletonDocument";

type SnapshotCase = {
  height: number;
  name: string;
  pathname: SiteRoutePath;
  width: number;
};

const desktopAndMobileSnapshots: SnapshotCase[] = siteRoutePaths.flatMap((pathname) => [
  { height: 900, name: "desktop-1280", pathname, width: 1280 },
  { height: 844, name: "mobile-390", pathname, width: 390 }
]);

const breakpointSnapshots: SnapshotCase[] = [
  { height: 900, name: "breakpoint-980", pathname: siteRoutes.home, width: 980 },
  { height: 900, name: "breakpoint-980", pathname: siteRoutes.projects, width: 980 },
  { height: 900, name: "breakpoint-980", pathname: siteRoutes.privacy, width: 980 }
];

const standaloneFixturePath = "/__skeleton-visual-fixture";
const standaloneFixtureRoute = "**/__skeleton-visual-fixture";

function snapshotName({ name, pathname }: SnapshotCase): string {
  return `skeleton-${pathname === siteRoutes.home ? "home" : pathname.slice(1)}-${name}.png`;
}

async function loadStandaloneRouteSkeleton(page: Page, pathname: SiteRoutePath): Promise<Locator> {
  const source = await collectStandaloneDocumentSource(page);
  if (source.htmlAttributes.find(([name]) => name === "data-theme")?.[1] !== "dark") {
    throw new Error("The source shell did not resolve the dark theme before the visual fixture loaded.");
  }
  const stylesheetHrefs = new Set(source.stylesheetHrefs);
  const fixtureAssetFailures: string[] = [];
  const isFixtureAssetRequest = (request: Request): boolean =>
    stylesheetHrefs.has(request.url()) || request.resourceType() === "font" || request.resourceType() === "stylesheet";
  const failedRequestListener = (request: Request) => {
    if (isFixtureAssetRequest(request)) {
      fixtureAssetFailures.push(`${request.url()}: ${request.failure()?.errorText ?? "request failed"}`);
    }
  };
  const failedResponseListener = (response: Response) => {
    if (isFixtureAssetRequest(response.request()) && response.status() >= 400) {
      fixtureAssetFailures.push(`${response.url()}: HTTP ${response.status()}`);
    }
  };

  page.on("requestfailed", failedRequestListener);
  page.on("response", failedResponseListener);
  await page.route(standaloneFixtureRoute, (route) =>
    route.fulfill({
      body: createStandaloneDocument(source, skeletonMarkupByRoute[pathname], {
        markerAttribute: "data-skeleton-visual-fixture"
      }),
      contentType: "text/html",
      status: 200
    })
  );

  try {
    await page.goto(standaloneFixturePath, { waitUntil: "load" });
    await expect(page).toHaveURL(new RegExp(`${standaloneFixturePath}$`));
    await expect(page.locator("nextjs-portal")).toHaveCount(0);
    await expect(page.locator("script")).toHaveCount(0);
    await expect(page.locator("[data-skeleton-visual-stylesheet]")).toHaveCount(source.stylesheetHrefs.length);
    await waitForStandaloneDocumentAssets(page, source);
    await settleDocumentLayout(page);

    if (fixtureAssetFailures.length > 0) {
      throw new Error(`Visual fixture asset request failure:\n${fixtureAssetFailures.join("\n")}`);
    }

    const skeletonRoot = page.locator(
      `[data-skeleton-visual-fixture] [data-skeleton-route="${pathname}"]`
    );
    await expect(skeletonRoot).toHaveCount(1);
    await expect(skeletonRoot.getByLabel("Loading page")).toHaveCount(1);
    await expect(skeletonRoot.getByLabel("Loading page")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("body")).toHaveCSS("font-family", /Space Grotesk/);
    await expect(skeletonRoot.locator(".skeleton-block").first()).toHaveCSS("display", "block");
    return skeletonRoot;
  } finally {
    page.off("requestfailed", failedRequestListener);
    page.off("response", failedResponseListener);
    await page.unroute(standaloneFixtureRoute);
  }
}

test.beforeAll(() => {
  if (process.platform !== "linux") {
    throw new Error(
      "Skeleton visual baselines are Linux-only. Run this specification on Ubuntu 24.04; do not create Windows or macOS snapshots."
    );
  }
});

for (const snapshot of [...desktopAndMobileSnapshots, ...breakpointSnapshots]) {
  test(`matches canonical ${snapshot.pathname} skeleton geometry at ${snapshot.name}`, async ({ page }) => {
    captureBrowserConsole(page);
    await page.setViewportSize({ height: snapshot.height, width: snapshot.width });
    await prepareDarkPage(page, "reduce");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".site-main > .page-container")).toHaveCount(1);
    expectNoBrowserConsoleIssues(page);

    const skeletonRoot = await loadStandaloneRouteSkeleton(page, snapshot.pathname);
    await expect(skeletonRoot.locator(".skeleton-block").first()).toHaveCSS("animation-name", "none");
    expectNoBrowserConsoleIssues(page);
    await expect(skeletonRoot).toHaveScreenshot(snapshotName(snapshot), {
      animations: "disabled",
      caret: "hide",
      maxDiffPixels: 0,
      scale: "css",
      threshold: 0
    });
    expectNoBrowserConsoleIssues(page);
  });
}
