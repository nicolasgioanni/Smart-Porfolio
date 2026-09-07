import { expect, test, triggerContactChallenge, type Page } from "./browserTest";
import {
  allowBrowserConsoleMessage,
  captureBrowserConsole,
  expectNoBrowserConsoleIssues
} from "./browserConsole";
import { settleLayout } from "./settleLayout";
import { selectThemeWithChooser } from "./themePreference";

async function gateGeometry(page: Page) {
  return page.locator(".contact-wizard, .contact-verification-gate > .contact-step__heading, .contact-verification-well, .contact-verification-gate > .contact-step__actions, .contact-email-fallback").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return [box.x + scrollX, box.y + scrollY, box.width, box.height].map((value) => Math.round(value * 10) / 10);
    })
  );
}

for (const width of [1280, 390, 320]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`keeps verification geometry at ${width}px with ${reducedMotion} motion`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion });
      let releaseResponse: (() => void) | undefined;
      let attempts = 0;
      await page.route("**/api/contact/verify", async (route) => {
        attempts += 1;
        await new Promise<void>((resolve) => { releaseResponse = resolve; });
        await route.fulfill({
          body: JSON.stringify(attempts === 1 ? { ok: false, error: "verification_unavailable" } : { ok: true }),
          contentType: "application/json", status: attempts === 1 ? 503 : 200
        });
      });
      await page.goto("/contact");
      await settleLayout(page);
      const challenge = page.getByRole("button", { name: "Complete test security check" });
      await expect(challenge).toBeVisible();
      const availableWidth = await page.locator(".contact-turnstile__widget").evaluate((element) => element.clientWidth);
      await expect(challenge).toHaveAttribute("data-size", availableWidth < 300 ? "compact" : "flexible");
      expect((await page.locator(".contact-turnstile__widget").boundingBox())?.height).toBe(availableWidth < 300 ? 140 : 65);
      const geometry = await gateGeometry(page);
      expect(geometry).toHaveLength(5);

      for (const theme of ["light", "dark", "navy"] as const) {
        await selectThemeWithChooser(page, theme);
        await expect(challenge).toHaveAttribute("data-theme", theme === "light" ? "light" : "dark");
        expect(await gateGeometry(page)).toEqual(geometry);
      }
      await triggerContactChallenge(page, "expired");
      await expect(page.getByRole("alert").filter({ hasText: "Contact error." })).toContainText("security check expired");
      expect(await gateGeometry(page)).toEqual(geometry);
      await triggerContactChallenge(page, "shrink");
      expect(await gateGeometry(page)).toEqual(geometry);
      await page.getByRole("button", { name: "Run check again" }).press("Enter");
      expect(await gateGeometry(page)).toEqual(geometry);
      await triggerContactChallenge(page, "error");
      expect(await gateGeometry(page)).toEqual(geometry);
      await page.getByRole("button", { name: "Run check again" }).press("Enter");

      await challenge.press("Enter");
      await expect(page.locator(".contact-gate-status")).toHaveAttribute("data-status", "verifying");
      expect(await gateGeometry(page)).toEqual(geometry);
      await expect.poll(() => Boolean(releaseResponse)).toBe(true);
      releaseResponse!();
      await expect(page.locator(".contact-gate-status")).toHaveAttribute("data-status", "failed");
      expect(await gateGeometry(page)).toEqual(geometry);
      await expect(page.locator(".contact-wizard .contact-notice")).toHaveCount(0);
      await page.getByRole("button", { name: "Try security check again" }).press("Enter");
      expect(await gateGeometry(page)).toEqual(geometry);
      // Hold only application timers so the verified state can be measured before auto-advance.
      await page.clock.install({ time: new Date("2026-09-12T12:00:00Z") });
      await page.clock.pauseAt(new Date("2026-09-12T13:00:00Z"));
      releaseResponse = undefined;
      await challenge.press("Enter");
      await expect.poll(() => Boolean(releaseResponse)).toBe(true);
      releaseResponse!();
      await expect(page.locator(".contact-gate-status")).toHaveAttribute("data-status", "verified");
      expect(await gateGeometry(page)).toEqual(geometry);
      await page.getByRole("button", { name: "Continue" }).press("Enter");
      await expect(page.getByRole("heading", { name: "Tell me your name" })).toBeFocused();
    });
  }
}

test("keeps stacked notifications readable, fixed, dismissible, and bounded on a short touch viewport", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 300 }, hasTouch: true });
  // Use the regular page fixture's provider helper in this touch-enabled context.
  const { installTurnstileMock } = await import("./browserTest");
  const page = await context.newPage();
  await installTurnstileMock(page);
  try {
    await page.route("**/api/contact/verify", (route) => route.fulfill({
      body: JSON.stringify({ ok: false, error: "verification_unavailable" }), contentType: "application/json", status: 503
    }));
    await page.goto("/contact");
    await settleLayout(page);
    await expect(page.getByRole("button", { name: "Complete test security check" })).toBeVisible();
    await triggerContactChallenge(page, "expired");
    await triggerContactChallenge(page, "error");
    await page.getByRole("button", { name: "Run check again" }).press("Enter");
    await page.getByRole("button", { name: "Complete test security check" }).press("Enter");
    const stack = page.getByRole("region", { name: "Contact notifications" });
    const cards = stack.locator(".contact-notice");
    await expect(cards).toHaveCount(3);
    await expect(stack).toHaveAttribute("data-expanded", "false");
    await expect(stack.getByRole("button", { name: /Dismiss notification/ })).toHaveCount(1);
    await expect.poll(async () => {
      const boxes = await stack.locator(".contact-notifications__item").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().bottom));
      return boxes.slice(1).map((bottom, i) => Math.round(bottom - boxes[i]));
    }).toEqual([10, 10]);
    const restingTop = (await stack.boundingBox())!.y;
    await page.mouse.wheel(0, 200);
    expect((await stack.boundingBox())!.y).toBe(restingTop);
    const stage = await stack.locator(".contact-notifications__stage").boundingBox();
    await page.touchscreen.tap(stage!.x + stage!.width / 2, stage!.y + stage!.height - 4);
    await expect(stack).toHaveAttribute("data-expanded", "true");
    await expect(stack.getByRole("button", { name: /Dismiss notification/ })).toHaveCount(3);
    expect(await stack.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    const bounds = (await stack.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(16);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(284);
    await page.clock.install();
    await page.clock.fastForward(60_000);
    await expect(cards).toHaveCount(3);
    await stack.getByRole("button", { name: "Collapse notifications" }).tap();
    await expect(stack).toHaveAttribute("data-expanded", "false");
    // Pointer focus must not reverse the requested collapsed -> expanded toggle.
    await stack.getByRole("button", { name: "Show all 3 notifications" }).tap();
    await expect(stack).toHaveAttribute("data-expanded", "true");
    const closes = stack.getByRole("button", { name: /Dismiss notification/ });
    await closes.nth(1).focus();
    await page.keyboard.press("Escape");
    await expect(stack).toHaveAttribute("data-expanded", "false");
    await expect(stack.getByRole("button", { name: "Show all 3 notifications" })).toBeFocused();
    await closes.first().press("Enter");
    await expect(cards).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Verify before continuing" })).toBeFocused();
    await closes.first().focus();
    await page.keyboard.press("Escape");
    await closes.first().press("Enter");
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Verify before continuing" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Try security check again" })).toBeAttached();
  } finally { await context.close(); }
});

test("preserves semantic colors, hover reading, and long success messages in every theme", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/contact/verify", (route) => route.fulfill({
    body: JSON.stringify({ ok: true }), contentType: "application/json", status: 200
  }));
  await page.route("**/api/contact", (route) => route.fulfill({
    body: JSON.stringify({ ok: true }), contentType: "application/json", status: 200
  }));
  await page.goto("/contact");
  await settleLayout(page);
  const challenge = page.getByRole("button", { name: "Complete test security check" });
  await expect(challenge).toBeVisible();
  await triggerContactChallenge(page, "error");
  await page.getByRole("button", { name: "Run check again" }).press("Enter");
  await challenge.press("Enter");
  await expect(page.getByRole("heading", { name: "Tell me your name" })).toBeFocused();
  await page.getByLabel("First name").fill("Avery");
  await page.getByLabel("Last name").fill("Nguyen");
  await page.getByRole("button", { name: "Next", exact: true }).press("Enter");
  const address = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.dev`;
  expect(address.length).toBe(254);
  await page.getByLabel("Email address").fill(address);
  await page.getByRole("textbox", { name: /^Message/ }).fill("A professional inquiry.");
  await page.getByRole("button", { name: "Review", exact: true }).press("Enter");
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "Send request", exact: true }).press("Enter");
  const completion = page.getByRole("heading", { name: "Thanks for reaching out" });
  await expect(completion).toBeFocused();
  const stack = page.getByRole("region", { name: "Contact notifications" });
  await expect(stack.locator(".contact-notice")).toHaveCount(2);
  const success = stack.locator('[data-tone="success"]');
  await expect(success).toContainText(address);
  for (const theme of ["light", "dark", "navy"] as const) {
    await completion.focus();
    await selectThemeWithChooser(page, theme);
    await page.keyboard.press("Escape");
    const colors = await stack.locator(".contact-notice").evaluateAll((cards) => cards.map((card) => ({
      tone: (card as HTMLElement).dataset.tone,
      rgb: getComputedStyle(card).color.match(/\d+/g)!.map(Number)
    })));
    for (const { tone, rgb: [red, green, blue] } of colors) {
      if (tone === "error") expect(red).toBeGreaterThan(Math.max(green, blue));
      else expect(green).toBeGreaterThan(Math.max(red, blue));
    }
  }
  await page.mouse.move(310, 550);
  await expect(stack).toHaveAttribute("data-expanded", "false");
  const close = success.getByRole("button", { name: /Dismiss notification/ });
  await expect(close).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(close).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await close.hover();
  await expect(stack).toHaveAttribute("data-expanded", "true");
  await expect.poll(() => close.evaluate((element) => getComputedStyle(element, "::before").opacity)).toBe("1");
  await page.clock.install();
  await page.clock.fastForward(60_000);
  await expect(stack.locator(".contact-notice")).toHaveCount(2);
  await page.mouse.move(310, 550);
  await expect(stack).toHaveAttribute("data-expanded", "false");
  const bounds = (await stack.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(12);
  expect(bounds.width).toBeLessThanOrEqual(296);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(552);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath("contact-long-success-mobile.png"), animations: "disabled" });
  const content = success.getByRole("group", { name: "Request submitted message" });
  await content.focus();
  expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await content.press("End");
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(success).toHaveCSS("animation-name", "none");
  await close.press("Enter");
  await expect(success).toHaveCount(0);
  await expect(completion).toBeVisible();
});

test("keeps the contact gate, form validation, recovery, and delivery flow in the browser", async ({ page }) => {
  let verificationAttempts = 0;
  const deliveryPayloads: Record<string, unknown>[] = [];

  await page.route("**/api/contact/verify", async (route) => {
    verificationAttempts += 1;
    await route.fulfill({
      body: JSON.stringify(
        verificationAttempts === 1
          ? { error: "service_unavailable", ok: false }
          : { ok: true }
      ),
      contentType: "application/json",
      status: verificationAttempts === 1 ? 503 : 200
    });
  });
  await page.route("**/api/contact", async (route) => {
    deliveryPayloads.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ body: JSON.stringify({ ok: true }), contentType: "application/json", status: 200 });
  });

  allowBrowserConsoleMessage(
    page,
    /^Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/
  );
  captureBrowserConsole(page);
  await page.goto("/contact");
  await settleLayout(page);

  await expect(page.getByRole("heading", { level: 2, name: "Verify before continuing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

  const challenge = page.getByRole("button", { name: "Complete test security check" });
  await challenge.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".contact-notice")).toContainText("Secure verification is temporarily unavailable");
  await expect(page.getByRole("button", { name: "Try security check again" })).toBeVisible();

  await page.getByRole("button", { name: "Try security check again" }).click();
  await page.getByRole("button", { name: "Complete test security check" }).press("Enter");
  const nameHeading = page.getByRole("heading", { level: 2, name: "Tell me your name" });
  await expect(nameHeading).toBeFocused();
  const firstName = page.getByLabel("First name");
  const lastName = page.getByLabel("Last name");
  const nextButton = page.getByRole("button", { exact: true, name: "Next" });
  await nextButton.press("Enter");
  await expect(firstName).toHaveAttribute("aria-invalid", "true");
  await expect(firstName).toBeFocused();

  await firstName.fill("Avery");
  await lastName.fill("Nguyen");
  await nextButton.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "How can I reach you?" })).toBeFocused();

  const email = page.getByLabel("Email address");
  for (const typo of ["nicolasmgioanni@gmail.con", "person@test.gomm"]) {
    await email.fill(typo);
    await email.press("Tab");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#contact-email-error")).toHaveText("Check the email domain ending for a typo.");
    const previousShake = await page.locator(".contact-form").getAttribute("data-validation-shake");
    await page.getByRole("button", { name: "Review" }).press("Enter");
    await expect(email).toBeFocused();
    expect(await page.locator(".contact-form").getAttribute("data-validation-shake")).not.toBe(previousShake);
    expect(deliveryPayloads).toHaveLength(0);
  }
  await email.fill("avery@example.com");
  await page.getByRole("textbox", { name: /^Message/ }).fill("I would like to discuss a professional opportunity.");
  await page.getByRole("button", { name: "Review" }).press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Review your request" })).toBeFocused();

  const acknowledgments = page.getByRole("checkbox");
  await acknowledgments.nth(0).focus();
  await page.keyboard.press("Space");
  await acknowledgments.nth(1).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Send request" }).press("Enter");

  await expect(page.getByRole("heading", { level: 2, name: "Thanks for reaching out" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Form submitted successfully");
  await page.locator('.contact-notice[data-tone="success"] button').press("Enter");
  await expect(page.locator('.contact-notice[data-tone="success"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Thanks for reaching out" })).toBeVisible();
  expect(verificationAttempts).toBe(2);
  expect(deliveryPayloads).toHaveLength(1);
  expect(deliveryPayloads[0]).toMatchObject({
    contactConsent: true,
    email: "avery@example.com",
    firstName: "Avery",
    lastName: "Nguyen",
    legalConsent: true,
    message: "I would like to discuss a professional opportunity."
  });
  expectNoBrowserConsoleIssues(page);
});
