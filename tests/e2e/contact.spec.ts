import { expect, test } from "./browserTest";
import {
  allowBrowserConsoleMessage,
  captureBrowserConsole,
  expectNoBrowserConsoleIssues
} from "./browserConsole";
import { settleLayout } from "./settleLayout";

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

  await page.getByLabel("Email address").fill("avery@example.com");
  await page.getByLabel("Message").fill("I would like to discuss a professional opportunity.");
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
