import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./browserTest";
import { settleLayout, settlePageEntryMotion } from "./settleLayout";

const routes = [
  ["/", /^Hi, I’m/],
  ["/experience", "Experience"],
  ["/research", "Applied AI Research"],
  ["/projects", "Projects"],
  ["/recommendations", "Recommendations"],
  ["/resume", "Resume"],
  ["/contact", "Contact"],
  ["/contact-terms", "Contact & Communication Terms"],
  ["/terms", "Site Terms & Accuracy Notice"],
  ["/privacy", "Privacy Notice"],
  ["/security", "Security & Responsible Disclosure"]
] as const;

function describeViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({ html: node.html, target: node.target, failureSummary: node.failureSummary }))
  }));
}

async function expectNoAxeViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(describeViolations(results.violations), `axe violations in ${state}`).toEqual([]);
}

async function gotoSettled(page: Page, pathname: string) {
  await page.goto(pathname);
  await settleLayout(page);
  await settlePageEntryMotion(page);
}

async function completeContactVerification(page: Page) {
  await page.route("**/api/contact/verify", (route) => route.fulfill({
    body: JSON.stringify({ ok: true }), contentType: "application/json", status: 200
  }));
  await gotoSettled(page, "/contact");
  await page.getByRole("button", { name: "Complete test security check" }).press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Tell me your name" })).toBeFocused();
}

async function settleContactStepMotion(page: Page) {
  await page.locator(".contact-step-frame").evaluate(async (frame) => {
    const activeStep = frame.querySelector<HTMLElement>(".contact-step");
    const animations = [frame, activeStep].flatMap((element) => element ? element.getAnimations() : []).filter(
      (animation) => animation instanceof CSSAnimation && animation.animationName === "page-body-enter"
    );
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function settleThemePopoverMotion(page: Page) {
  await page.locator(".theme-switcher__popover[data-state='open']").evaluate(async (popover) => {
    await Promise.all(popover.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test.describe("public-route accessibility", () => {
  test("has no axe violations on all eleven public routes", async ({ page }) => {
    for (const [pathname, heading] of routes) {
      await gotoSettled(page, pathname);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoAxeViolations(page, pathname);
    }
  });

  test("keeps the theme chooser keyboard reachable and accessible", async ({ page }) => {
    await gotoSettled(page, "/");
    const trigger = page.getByRole("button", { name: /choose color theme/i });
    await trigger.focus();
    const chooser = page.getByRole("group", { name: "Color theme preference" });
    await expect(chooser).toBeVisible();
    await settleThemePopoverMotion(page);
    await expectNoAxeViolations(page, "open theme chooser");
    await page.keyboard.press("Tab");
    await expect(chooser.getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test("keeps the shared graphical-abstract dialog accessible and returns focus on Escape", async ({ page }) => {
    await gotoSettled(page, "/research");
    const trigger = page.locator("button.research-abstract__trigger").first();
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog", { name: /Graphical abstract for/ });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page, "open graphical abstract dialog");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("keeps contact validation and review states accessible", async ({ page }) => {
    await completeContactVerification(page);
    await page.getByLabel("First name").fill("Avery");
    await page.getByLabel("Last name").fill("Nguyen");
    await page.getByRole("button", { exact: true, name: "Next" }).press("Enter");
    await settleContactStepMotion(page);
    await page.getByLabel("Email address").fill("invalid");
    await page.getByRole("button", { name: "Review" }).press("Enter");
    await expect(page.getByText("Enter a valid email address", { exact: true })).toBeVisible();
    await settleContactStepMotion(page);
    await expectNoAxeViolations(page, "contact invalid details");
    await page.getByLabel("Email address").fill("avery@example.com");
    await page.getByRole("textbox", { name: /^Message/ }).fill("A detailed professional inquiry for accessibility coverage.");
    await page.getByRole("button", { name: "Review" }).press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Review your request" })).toBeVisible();
    await settleContactStepMotion(page);
    await expectNoAxeViolations(page, "contact review");
    await page.getByRole("button", { exact: true, name: "Back" }).press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "How can I reach you?" })).toBeFocused();
    await settleContactStepMotion(page);
  });

  test("keeps Research video controls and Experience evidence accessible while expanded", async ({ page }) => {
    await gotoSettled(page, "/research");
    const video = page.getByTestId("research-video-player");
    await expect(video).toBeVisible();
    await video.hover();
    const settingsTrigger = video.getByRole("button", { name: "Open video settings" });
    await expect(settingsTrigger).toBeVisible();
    await settingsTrigger.focus();
    await settingsTrigger.press("Enter");
    await expect(video.getByTestId("video-settings")).toHaveAttribute("data-open", "true");
    await expectNoAxeViolations(page, "Research video settings");

    await gotoSettled(page, "/experience");
    const trigger = page.locator("button.detail-section__trigger").first();
    await expect(trigger).toBeVisible();
    const panelId = await trigger.getAttribute("aria-controls");
    if (!panelId) throw new Error("Experience evidence trigger must identify its controlled panel.");
    await trigger.focus();
    await trigger.press("Enter");
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await expectNoAxeViolations(page, "expanded Experience evidence");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
});
