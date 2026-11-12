import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { selectHomeContent } from "../../src/features/home/content/selectHomeContent";
import { selectProjectDetailContent } from "../../src/features/projects/content/selectProjectDetailContent";
import { getProjectVisual } from "../../src/features/projects/selectors/projectVisualRegistry";
import { selectResearchDetailContent } from "../../src/features/research/content/selectResearchDetailContent";
import { getResearchGraphicalAbstract } from "../../src/features/research/content/researchGraphicalAbstracts";
import { getResearchDisplayTitle } from "../../src/features/research/content/researchNarratives";
import { getResearchVideo } from "../../src/features/research/content/researchVideos";
import { resolveRouteHeaderContent } from "../../src/lib/content/routeHeaderContent";
import { siteRoutePaths, siteRoutes } from "../../src/lib/routing/siteRoutes";
import { readGeneratedPortfolioContent } from "../../tests/e2e/generatedContent";
import { installTurnstileMock } from "../../tests/e2e/browserTest";
import { selectThemeWithChooser } from "../../tests/e2e/themePreference";
import { inlineScriptSources } from "./csp.mjs";

function scriptSource(policy: string) {
  return policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] ?? "";
}

function scriptHash(content: string) {
  return `'sha256-${createHash("sha256").update(content, "utf8").digest("base64")}'`;
}

function policyForRoute(headers: string, route: string) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = headers.match(new RegExp(
    `^${escapedRoute}\\n  ! Content-Security-Policy\\n  Content-Security-Policy: (.+)$`,
    "m"
  ));
  if (!match?.[1]) throw new Error(`Expected a generated CSP replacement rule for ${route}.`);
  return match[1];
}

test("serves the sealed Pages export with the generated route CSP", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();
  expect((await response!.headersArray()).filter((header) => header.name.toLowerCase() === "content-security-policy")).toHaveLength(1);
  expect(response!.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(response!.headers()["content-security-policy"]).not.toContain("script-src 'self' 'unsafe-inline'");
  await expect(page.getByRole("heading", { level: 1, name: /^Hi, I’m/ })).toBeVisible();
});

async function expectStaticProjects(page: Page) {
  const projects = selectProjectDetailContent(readGeneratedPortfolioContent());
  const cards = page.locator("main article.project-card--showcase:visible");
  await expect(cards).toHaveCount(projects.length);
  if (!projects.length) {
    await expect(page.getByRole("status")).toHaveText("Project entries will appear here when content is available.");
  }
  for (const [index, project] of projects.entries()) {
    const card = cards.nth(index);
    await expect(card.getByRole("heading", { level: 2, name: project.title, exact: true })).toBeVisible();
    if (getProjectVisual(project.id)) {
      await expect(card.locator(".project-visual-static__preview")).toBeVisible();
      const details = card.locator("details.project-visual-static__details");
      await expect(details).toHaveCount(1);
      await expect(details).not.toHaveAttribute("open", "");
      await details.locator("summary").click();
      await expect(details).toHaveAttribute("open", "");
      await details.locator("summary").click();
      await expect(details).not.toHaveAttribute("open", "");
    }
  }
}

async function expectStaticResearch(page: Page) {
  const research = selectResearchDetailContent(readGeneratedPortfolioContent());
  const cards = page.locator("main article.research-project:visible");
  await expect(cards).toHaveCount(research.length);
  if (!research.length) {
    await expect(page.getByRole("status")).toHaveText("Research entries will appear here when content is available.");
  }
  for (const [index, item] of research.entries()) {
    const card = cards.nth(index);
    await expect(card.getByRole("heading", { level: 2, name: getResearchDisplayTitle(item), exact: true })).toBeVisible();
    const abstract = getResearchGraphicalAbstract(item);
    const video = getResearchVideo(item);
    if (abstract) {
      const image = card.locator(".research-abstract__thumbnail");
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute("src", abstract.src);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }
    // The visual renders a video only when an abstract can supply its poster.
    if (abstract && video) {
      const player = card.locator("video.research-video-player__media");
      await expect(player).toBeVisible();
      await expect(player).toHaveAttribute("controls", "");
      await expect(player.locator("source")).toHaveAttribute("src", video.src);
      await expect(player.locator('track[kind="captions"]')).toHaveAttribute("src", video.captionsSrc);
      const videoResponse = await page.request.get(video.src, { headers: { Range: "bytes=0-0" } });
      expect(videoResponse.ok()).toBe(true);
      expect(videoResponse.headers()["content-type"]).toContain(video.mimeType);
      const captions = await page.request.get(video.captionsSrc);
      expect(captions.ok()).toBe(true);
      expect(await captions.text()).toMatch(/^\uFEFF?WEBVTT/);
      const transcript = await page.request.get(video.transcriptSrc);
      expect(transcript.ok()).toBe(true);
      expect((await transcript.text()).trim().length).toBeGreaterThan(0);
    }
  }
}

test("serves every published static route without JavaScript", async ({ browser }) => {
  const content = readGeneratedPortfolioContent();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const route of siteRoutePaths) {
      const response = await page.goto(route);
      expect(response?.ok()).toBe(true);
      const main = page.locator("main");
      await expect(main).toHaveCount(1);
      expect(await page.title()).toContain("Nicolas Gioanni");
      const header = resolveRouteHeaderContent(route, content);
      if (header) {
        await expect(main.getByRole("heading", { level: 1, name: header.title, exact: true })).toBeVisible();
        await expect(main.getByText(header.description, { exact: true }).filter({ visible: true })).toBeVisible();
      } else {
        await expect(main.getByRole("heading", { level: 1, name: /^Hi, I’m/ })).toBeVisible();
        await expect(main.locator(".home-overview-grid .home-section__header").getByRole("heading", { name: "Education", exact: true })).toBeVisible();
        const education = selectHomeContent(content).education;
        const educationCards = main.locator(".home-education-item:visible");
        await expect(educationCards).toHaveCount(education.length);
        if (education.length === 0) {
          await expect(main.getByText("Education rows will appear here when content is available.", { exact: true }).filter({ visible: true })).toBeVisible();
        }
        for (const [index, item] of education.entries()) {
          await expect(educationCards.nth(index).getByRole("heading", { name: item.institution, exact: true })).toBeVisible();
        }
      }
      for (const label of ["Footer notices", "Footer resources"]) {
        const navigation = page.locator(".blob-footer__noscript").getByRole("navigation", { name: label });
        await expect(navigation).toBeVisible();
        expect(await navigation.getByRole("link").count()).toBeGreaterThan(0);
        await expect(navigation.getByRole("link").first()).toBeVisible();
      }
      if (route === siteRoutes.projects) await expectStaticProjects(page);
      if (route === siteRoutes.research) await expectStaticResearch(page);
    }
  } finally { await context.close(); }
});

test("hydrates and navigates the sealed export without CSP violations", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    (window as Window & { cspViolations?: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => (window as Window & { cspViolations?: string[] }).cspViolations?.push(event.violatedDirective));
  });
  await page.goto("/");
  await selectThemeWithChooser(page, "dark");
  await page.evaluate(() => { (window as Window & { exportDocumentMarker?: Document }).exportDocumentMarker = document; });
  await page.getByRole("link", { name: "View Projects", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/?$/);
  await expect(page.locator("main").getByRole("heading", { level: 1, name: "Projects", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => (window as Window & { exportDocumentMarker?: Document }).exportDocumentMarker === document)).toBe(true);
  expect(await page.evaluate(() => (window as Window & { cspViolations?: string[] }).cspViolations ?? [])).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("blocks an unauthorized inline script under the sealed route policy", async ({ page }) => {
  await page.goto("/");
  await page.addScriptTag({ content: "window.__portfolioUnapprovedInlineScript = true;" }).catch(() => undefined);
  await expect.poll(() => page.evaluate(() => "__portfolioUnapprovedInlineScript" in window)).toBe(false);
});

test("blocks an inline script that belongs only to another route", async ({ page }) => {
  const outputDirectory = path.resolve(process.env.PLAYWRIGHT_RELEASE_OUT ?? "out");
  const [headers, homeHtml, contactHtml] = await Promise.all([
    readFile(path.join(outputDirectory, "_headers"), "utf8"),
    readFile(path.join(outputDirectory, "index.html"), "utf8"),
    readFile(path.join(outputDirectory, "contact.html"), "utf8")
  ]);
  const homeHashes = new Set(inlineScriptSources(homeHtml).map(scriptHash));
  const contactOnlyScript = inlineScriptSources(contactHtml).find((script: string) =>
    script.includes("self.__next_f.push") && !homeHashes.has(scriptHash(script))
  );
  if (!contactOnlyScript) throw new Error("Expected final contact HTML to contain a contact-only executable script.");

  const contactOnlyHash = scriptHash(contactOnlyScript);
  expect(policyForRoute(headers, "/")).not.toContain(contactOnlyHash);

  await page.goto("/");
  await page.evaluate(() => {
    const target = window as typeof window & { cspViolations?: string[] };
    target.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => target.cspViolations?.push(event.violatedDirective));
  });
  await page.addScriptTag({ content: contactOnlyScript }).catch(() => undefined);
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { cspViolations?: string[] }).cspViolations?.some(
      (directive) => directive.startsWith("script-src")
    ) ?? false
  ))).toBe(true);
});

test("keeps CSP hashes on explicit HTML aliases and missing-route 404 responses", async ({ page }) => {
  const aliasResponse = await page.goto("/index.html");
  const aliasPolicy = aliasResponse?.headers()["content-security-policy"];
  if (!aliasPolicy) throw new Error("Expected the Pages HTML alias response to include a CSP header.");
  expect(scriptSource(aliasPolicy)).toContain("'sha256-");
  expect(scriptSource(aliasPolicy)).not.toContain("'unsafe-inline'");

  const missingResponse = await page.goto("/a-route-that-is-not-exported");
  expect(missingResponse?.status()).toBe(404);
  const missingPolicy = missingResponse?.headers()["content-security-policy"];
  if (!missingPolicy) throw new Error("Expected the Pages 404 response to include a CSP header.");
  expect(scriptSource(missingPolicy)).toContain("'sha256-");
  expect(scriptSource(missingPolicy)).not.toContain("'unsafe-inline'");
  await expect(page.getByRole("button", { name: /choose color theme/i })).toBeVisible();
  await selectThemeWithChooser(page, "dark");
});

test("loads the mocked Turnstile provider through the allowed CSP source and hydrates the verification gate", async ({ page }) => {
  await installTurnstileMock(page, "provider-script");
  await page.route("**/api/contact/verify", (route) =>
    route.fulfill({ body: JSON.stringify({ ok: true }), contentType: "application/json", status: 200 })
  );

  const response = await page.goto("/contact");
  const policy = response?.headers()["content-security-policy"];
  if (!policy) throw new Error("Expected the Pages contact response to include a CSP header.");
  expect(scriptSource(policy)).toContain("https://challenges.cloudflare.com");
  await expect.poll(() => page.evaluate(() => Boolean(window.turnstile))).toBe(true);

  const challenge = page.getByRole("button", { name: "Complete test security check" });
  await expect(challenge).toBeVisible();
  await challenge.press("Enter");
  await expect(page.getByRole("heading", { name: "Tell me your name" })).toBeFocused();
});
