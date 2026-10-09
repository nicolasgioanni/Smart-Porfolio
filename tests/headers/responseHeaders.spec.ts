import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "../e2e/browserTest";
import { reloadWithStoredTheme, selectThemeWithChooser } from "../e2e/themePreference";
import { createStaticScriptHash, extractInlineScriptContents } from "../../scripts/staticResponseHeaders.mjs";

test.use({ turnstileMockMode: "provider-script" });

function scriptSource(policy: string) {
  return policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] ?? "";
}

function generatedPolicyForRoute(headers: string, route: string) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = headers.match(new RegExp(`^${escapedRoute}\\n  Content-Security-Policy: (.+)$`, "m"));
  if (!match?.[1]) throw new Error(`Expected a generated CSP rule for ${route}.`);
  return match[1];
}

test("serves generated CSP hashes while hydration and theme preference remain available", async ({ page }) => {
  const response = await page.goto("/");
  const policy = response?.headers()["content-security-policy"];
  if (!policy) throw new Error("Expected the Pages static response to include a CSP header.");

  expect(scriptSource(policy)).toContain("'sha256-");
  expect(scriptSource(policy)).not.toContain("'unsafe-inline'");
  await expect(page.getByRole("button", { name: /choose color theme/i })).toBeVisible();

  await reloadWithStoredTheme(page, "navy");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "navy");
  await selectThemeWithChooser(page, "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("blocks an unauthorized inline script under the generated policy", async ({ page }) => {
  await page.goto("/");

  await page.addScriptTag({ content: "window.__portfolioUnapprovedInlineScript = true;" }).catch(() => undefined);

  await expect.poll(() => page.evaluate(() => "__portfolioUnapprovedInlineScript" in window)).toBe(false);
});

test("requires the route-specific CSP in addition to the wildcard hash union", async ({ page }) => {
  const outputDirectory = path.join(process.cwd(), "out");
  const [headers, homeHtml, contactHtml] = await Promise.all([
    readFile(path.join(outputDirectory, "_headers"), "utf8"),
    readFile(path.join(outputDirectory, "index.html"), "utf8"),
    readFile(path.join(outputDirectory, "contact.html"), "utf8")
  ]);
  const homeHashes = new Set(extractInlineScriptContents(homeHtml).map(createStaticScriptHash));
  const contactOnlyScript = extractInlineScriptContents(contactHtml).find((script) =>
    script.includes("self.__next_f.push") && !homeHashes.has(createStaticScriptHash(script))
  );
  if (!contactOnlyScript) throw new Error("Expected the final contact HTML to contain a contact-only executable script.");

  const contactOnlyHash = createStaticScriptHash(contactOnlyScript);
  expect(generatedPolicyForRoute(headers, "/*")).toContain(contactOnlyHash);
  expect(generatedPolicyForRoute(headers, "/")).not.toContain(contactOnlyHash);

  await page.goto("/");
  await page.evaluate(() => {
    const target = window as typeof window & { portfolioCspViolations?: string[] };
    target.portfolioCspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      target.portfolioCspViolations?.push(event.violatedDirective);
    });
  });
  await page.addScriptTag({ content: contactOnlyScript }).catch(() => undefined);

  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { portfolioCspViolations?: string[] }).portfolioCspViolations?.some(
      (directive) => directive.startsWith("script-src")
    ) ?? false
  ))).toBe(true);
});

test("keeps CSP hashes on explicit HTML aliases and unknown-path 404 responses", async ({ page }) => {
  const aliasResponse = await page.goto("/index.html");
  const aliasPolicy = aliasResponse?.headers()["content-security-policy"];
  if (!aliasPolicy) throw new Error("Expected the Pages HTML alias response to include a CSP header.");
  expect(scriptSource(aliasPolicy)).toContain("'sha256-");
  expect(scriptSource(aliasPolicy)).not.toContain("'unsafe-inline'");

  const missingResponse = await page.goto("/a-route-that-is-not-exported");
  const missingPolicy = missingResponse?.headers()["content-security-policy"];
  if (!missingPolicy) throw new Error("Expected the Pages 404 fallback response to include a CSP header.");
  expect(scriptSource(missingPolicy)).toContain("'sha256-");
  expect(scriptSource(missingPolicy)).not.toContain("'unsafe-inline'");
  await expect(page.getByRole("button", { name: /choose color theme/i })).toBeVisible();
  await selectThemeWithChooser(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("permits the contact Turnstile script source and hydrates the mocked verification gate", async ({ page }) => {
  await page.route("**/api/contact/verify", (route) =>
    route.fulfill({ body: JSON.stringify({ ok: true }), contentType: "application/json", status: 200 })
  );

  const response = await page.goto("/contact");
  const policy = response?.headers()["content-security-policy"];
  if (!policy) throw new Error("Expected the Pages contact response to include a CSP header.");

  expect(scriptSource(policy)).toContain("https://challenges.cloudflare.com");
  const challenge = page.getByRole("button", { name: "Complete test security check" });
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { turnstile?: unknown }).turnstile))).toBe(true);
  await expect(challenge).toBeVisible();
  await challenge.press("Enter");
  await expect(page.getByRole("heading", { name: "Tell me your name" })).toBeFocused();
});
