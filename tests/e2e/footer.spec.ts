import { expect, test, type Page } from "@playwright/test";
import { siteRoutePaths } from "../../src/components/navigation/siteRoutes";

type FooterSample = {
  detailsHeight: number;
  expanded: string | null;
  heading: string;
  hidden: string | null;
  inert: boolean;
  label: string;
  pathname: string;
  phase: "frame" | "mutation";
  state: string | null;
};

const missingRoute = "/footer-initial-state-regression-404";

test.describe.configure({ mode: "default" });

async function installFooterRecorder(page: Page) {
  await page.addInitScript(() => {
    const recorderWindow = window as Window & { __footerSamples?: FooterSample[] };
    const samples: FooterSample[] = [];
    let previousSignature = "";
    recorderWindow.__footerSamples = samples;

    const record = (phase: FooterSample["phase"]) => {
      const footer = document.querySelector<HTMLElement>(".blob-footer");
      const toggle = footer?.querySelector<HTMLButtonElement>(".blob-footer__toggle");
      const details = footer?.querySelector<HTMLElement>(".blob-footer__details");
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!footer || !toggle || !details || !heading) return;

      const sample: FooterSample = {
        detailsHeight: Math.round(details.getBoundingClientRect().height * 100) / 100,
        expanded: toggle.getAttribute("aria-expanded"),
        heading: heading.textContent?.trim() ?? "",
        hidden: details.getAttribute("aria-hidden"),
        inert: details.hasAttribute("inert"),
        label: toggle.textContent?.trim() ?? "",
        pathname: window.location.pathname,
        phase,
        state: footer.getAttribute("data-footer-state")
      };
      const signature = JSON.stringify(sample);
      if (signature === previousSignature) return;

      previousSignature = signature;
      samples.push(sample);
    };

    new MutationObserver(() => record("mutation")).observe(document, {
      attributes: true,
      attributeFilter: ["aria-expanded", "aria-hidden", "class", "data-footer-state", "inert"],
      childList: true,
      subtree: true
    });

    const recordFrame = () => {
      record("frame");
      window.requestAnimationFrame(recordFrame);
    };
    window.requestAnimationFrame(recordFrame);
  });
}

async function settleLayout(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  });
}

async function expectCompactFooter(page: Page) {
  const footer = page.locator(".blob-footer");
  const toggle = footer.locator(".blob-footer__toggle");
  const details = footer.locator(".blob-footer__details");

  await expect(footer).toHaveAttribute("data-footer-state", "compact");
  await expect(footer).toHaveClass(/blob-footer--compact/);
  await expect(toggle).toHaveText("Details");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(details).toHaveAttribute("aria-hidden", "true");
  await expect(details).toHaveAttribute("inert", "");
  await expect.poll(() => details.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
}

async function expectNoExpandedSamples(page: Page, pathname: string, heading: string) {
  const samples = await page.evaluate(() => {
    const recorderWindow = window as Window & { __footerSamples?: FooterSample[] };
    return recorderWindow.__footerSamples ?? [];
  });
  const routeSamples = samples.filter((sample) => sample.pathname === pathname && sample.heading === heading);

  expect(routeSamples.length, `No footer samples were recorded for ${pathname}.`).toBeGreaterThan(0);
  expect(
    routeSamples.filter(
      (sample) =>
        sample.state !== "compact" ||
        sample.label !== "Details" ||
        sample.expanded !== "false" ||
        sample.hidden !== "true" ||
        !sample.inert
    ),
    `The footer exposed an expanded semantic state while ${pathname} rendered.`
  ).toEqual([]);
  expect(
    routeSamples.filter((sample) => sample.phase === "frame" && sample.detailsHeight > 1),
    `The footer painted expanded details while ${pathname} rendered.`
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await installFooterRecorder(page);
  await page.setViewportSize({ width: 1280, height: 720 });
});

for (const pathname of [...siteRoutePaths, missingRoute]) {
  test(`keeps ${pathname} compact through its first settled render`, async ({ page }) => {
    await page.goto(pathname);
    await settleLayout(page);
    await expectCompactFooter(page);

    const heading = (await page.locator("main h1").innerText()).trim();
    await expectNoExpandedSamples(page, pathname, heading);
  });
}

for (const targetPath of siteRoutePaths) {
  test(`never carries expanded footer state into client navigation to ${targetPath}`, async ({ page }) => {
    const originPath = targetPath === "/" ? "/terms" : "/";
    await page.goto(originPath);
    await settleLayout(page);

    const originHeading = (await page.locator("main h1").innerText()).trim();
    await page.locator(".blob-footer__toggle").click();
    await expect(page.locator(".blob-footer")).toHaveAttribute("data-footer-state", "expanded");

    const targetLink = page.locator(`a[href="${targetPath}"]`).first();
    await expect(targetLink).toBeAttached();
    await targetLink.evaluate((link: HTMLAnchorElement) => {
      link.focus({ preventScroll: true });
      link.click();
    });

    await page.waitForURL((url) => url.pathname === targetPath);
    await expect.poll(() => page.locator("main h1").innerText()).not.toBe(originHeading);
    await settleLayout(page);
    await expectCompactFooter(page);

    const targetHeading = (await page.locator("main h1").innerText()).trim();
    await expectNoExpandedSamples(page, targetPath, targetHeading);
  });
}

test("expands only after a real downward wheel reaches the footer runway", async ({ page }) => {
  await page.goto("/terms");
  await settleLayout(page);
  await expectCompactFooter(page);

  const downwardDistance = await page.locator(".blob-footer__runway-sentinel").evaluate((sentinel) => {
    return Math.max(1, Math.ceil(sentinel.getBoundingClientRect().bottom - window.innerHeight + 8));
  });
  await page.mouse.wheel(0, downwardDistance);

  await expect(page.locator(".blob-footer")).toHaveAttribute("data-footer-state", "expanded");
  await expect(page.locator(".blob-footer__toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".blob-footer__details")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator(".blob-footer__details")).not.toHaveAttribute("inert", "");
});

test("keeps a restored deep position compact after reload", async ({ page }) => {
  await page.goto("/terms");
  await settleLayout(page);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.reload();
  await settleLayout(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expectCompactFooter(page);

  const heading = (await page.locator("main h1").innerText()).trim();
  await expectNoExpandedSamples(page, "/terms", heading);
});
