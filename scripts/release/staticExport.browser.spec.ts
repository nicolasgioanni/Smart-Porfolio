import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/experience", "/projects", "/recommendations", "/research", "/resume", "/contact", "/privacy", "/terms", "/security", "/contact-terms"] as const;

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
