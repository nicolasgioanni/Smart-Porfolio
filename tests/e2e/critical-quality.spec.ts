import { expect, test } from "./browserTest";

async function verifyContactRecovery(page: import("@playwright/test").Page) {
  await page.route("**/api/contact/verify", (route) => route.fulfill({
    body: JSON.stringify({ ok: true }), contentType: "application/json", status: 200
  }));
  await page.goto("/contact");
  await page.getByRole("button", { name: "Complete test security check" }).press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Tell me your name" })).toBeFocused();
  await page.getByLabel("First name").fill("Avery");
  await page.getByLabel("Last name").fill("Nguyen");
  await page.getByRole("button", { exact: true, name: "Next" }).press("Enter");
  await page.getByLabel("Email address").fill("invalid");
  await page.getByRole("button", { name: "Review" }).press("Enter");
  await expect(page.getByText("Enter a valid email address", { exact: true })).toBeVisible();
  await page.getByLabel("Email address").fill("avery@example.com");
  await page.getByRole("textbox", { name: /^Message/ }).fill("A browser-engine recovery check with enough detail.");
  await page.getByRole("button", { name: "Review" }).press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Review your request" })).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Back" }).press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "How can I reach you?" })).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveValue("avery@example.com");
}

test("preserves critical navigation, theme, dialog, and contact recovery across browser engines", async ({ page }) => {
  await page.goto("/");
  const themeTrigger = page.getByRole("button", { name: /choose color theme/i });
  const themePanelId = await themeTrigger.getAttribute("aria-controls");
  if (!themePanelId) throw new Error("Theme chooser trigger must identify its controlled panel.");
  await themeTrigger.focus();
  const chooser = page.locator(`#${themePanelId}`).getByRole("group", { name: "Color theme preference" });
  await expect(chooser).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(chooser.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(themeTrigger).toBeFocused();

  const researchLink = page.locator('a[href="/research"]:visible').first();
  await expect(researchLink).toBeVisible();
  await researchLink.press("Enter");
  await expect(page).toHaveURL(/\/research$/);
  const abstractTrigger = page.locator("button.research-abstract__trigger").first();
  await expect(abstractTrigger).toBeVisible();
  await abstractTrigger.focus();
  await abstractTrigger.press("Enter");
  await expect(page.getByRole("dialog", { name: /Graphical abstract for/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(abstractTrigger).toBeFocused();

  await verifyContactRecovery(page);
});
