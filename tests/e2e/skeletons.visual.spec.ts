import { expect, test, type Locator, type Page, type Request, type Response } from "@playwright/test";
import { siteRoutePaths, siteRoutes, type SiteRoutePath } from "../../src/components/navigation/siteRoutes";
import { captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";
import { skeletonMarkupByRoute } from "./skeletonMarkup";
import { prepareDarkPage, settleDocumentLayout } from "./skeletonTestHelpers";

type SnapshotCase = {
  height: number;
  name: string;
  pathname: SiteRoutePath;
  width: number;
};

type StandaloneDocumentSource = {
  bodyAttributes: [string, string][];
  htmlAttributes: [string, string][];
  stylesheetHrefs: string[];
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

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function serializeAttributes(attributes: [string, string][]): string {
  return attributes.map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(" ");
}

function createStandaloneDocument(source: StandaloneDocumentSource, markup: string): string {
  const stylesheets = source.stylesheetHrefs
    .map((href) => `<link data-skeleton-visual-stylesheet rel="stylesheet" href="${escapeAttribute(href)}">`)
    .join("");

  return `<!doctype html>
<html ${serializeAttributes(source.htmlAttributes)}>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${stylesheets}
  </head>
  <body ${serializeAttributes(source.bodyAttributes)}>
    <main data-skeleton-visual-fixture>${markup}</main>
  </body>
</html>`;
}

async function collectStandaloneDocumentSource(page: Page): Promise<StandaloneDocumentSource> {
  const source = (await page.evaluate(() => ({
    bodyAttributes: Array.from(document.body.attributes, ({ name, value }) => [name, value]),
    htmlAttributes: Array.from(document.documentElement.attributes, ({ name, value }) => [name, value]),
    stylesheetHrefs: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), (link) => link.href)
  }))) as StandaloneDocumentSource;

  if (source.stylesheetHrefs.length === 0) {
    throw new Error("The source shell did not expose a compiled stylesheet href for the visual fixture.");
  }
  if (source.htmlAttributes.find(([name]) => name === "data-theme")?.[1] !== "dark") {
    throw new Error("The source shell did not resolve the dark theme before the visual fixture loaded.");
  }
  if (!source.bodyAttributes.some(([name]) => name === "class")) {
    throw new Error("The source shell did not expose the generated body font class for the visual fixture.");
  }

  return source;
}

async function loadStandaloneRouteSkeleton(page: Page, pathname: SiteRoutePath): Promise<Locator> {
  const source = await collectStandaloneDocumentSource(page);
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
      body: createStandaloneDocument(source, skeletonMarkupByRoute[pathname]),
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
    await page.waitForFunction((hrefs) => {
      const stylesheets = Array.from(document.querySelectorAll<HTMLLinkElement>("[data-skeleton-visual-stylesheet]"));
      return hrefs.every((href) => stylesheets.some((stylesheet) => stylesheet.href === href && stylesheet.sheet));
    }, source.stylesheetHrefs);
    await page.evaluate(async () => {
      await document.fonts.load('16px "Space Grotesk"');
      await document.fonts.ready;
    });
    await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Space Grotesk"'))).toBe(true);
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
