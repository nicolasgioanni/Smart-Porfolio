import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { installTurnstileMock } from "../../tests/e2e/browserTest";
import { selectThemeWithChooser } from "../../tests/e2e/themePreference";
import { inlineScriptSources } from "./csp.mjs";

const publicRoutes = ["/", "/experience", "/projects", "/recommendations", "/research", "/resume", "/contact", "/privacy", "/terms", "/security", "/contact-terms"] as const;

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

test("serves every published static route without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const route of publicRoutes) {
      const response = await page.goto(route);
      expect(response?.ok()).toBe(true);
      await expect(page.locator("main")).toHaveCount(1);
      expect(await page.title()).toContain("Nicolas Gioanni");
    }
  } finally { await context.close(); }
});

test("hydrates the sealed export without CSP violations", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { cspViolations?: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => (window as Window & { cspViolations?: string[] }).cspViolations?.push(event.violatedDirective));
  });
  await page.goto("/");
  await page.getByRole("button", { name: /choose color theme/i }).focus();
  await expect(page.getByRole("group", { name: "Color theme preference" })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { cspViolations?: string[] }).cspViolations ?? [])).toEqual([]);
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
