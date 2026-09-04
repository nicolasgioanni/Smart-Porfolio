import { expect, test } from "@playwright/test";

test.describe("Experience showcase", () => {
  test("switches audience depth and keeps one chapter open per role", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/experience");

    const cards = page.locator(".experience-card");
    const modeGroup = page.getByRole("group", { name: "Experience detail level" });

    await expect(page.getByRole("heading", { level: 1, name: "Experience" })).toBeVisible();
    await expect(cards).toHaveCount(5);
    await expect(modeGroup.getByRole("button", { name: "For everyone" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/Built and deployed CytoCV/)).toBeVisible();

    const treasuryCard = page
      .getByRole("heading", { level: 2, name: "AI Engineer" })
      .locator("xpath=ancestor::article");
    await expect(treasuryCard.getByText("Details not yet available.")).toBeVisible();
    await expect(treasuryCard.locator(".experience-chapter")).toHaveCount(0);

    await modeGroup.getByRole("button", { name: "Technical" }).click();
    await expect(modeGroup.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/Architecture, implementation details, tooling/)).toBeVisible();

    const cytocvCard = page
      .getByRole("heading", { level: 2, name: "Research Assistant (Software Engineering)" })
      .locator("xpath=ancestor::article");
    const architecture = cytocvCard.getByRole("button", { name: /Application architecture/i });
    const vision = cytocvCard.getByRole("button", { name: /Vision pipeline/i });

    const [architectureIconBox, visionIconBox] = await Promise.all([
      architecture.locator(".experience-chapter__icon").boundingBox(),
      vision.locator(".experience-chapter__icon").boundingBox()
    ]);
    expect(architectureIconBox).not.toBeNull();
    expect(visionIconBox).not.toBeNull();
    expect(
      Math.abs(
        architectureIconBox!.x + architectureIconBox!.width -
          (visionIconBox!.x + visionIconBox!.width)
      )
    ).toBeLessThanOrEqual(1);

    await architecture.click();
    await expect(architecture).toHaveAttribute("aria-expanded", "true");
    await expect(cytocvCard.getByRole("list", { name: "Application architecture tools" })).toBeVisible();
    await expect(cytocvCard.getByText("PostgreSQL", { exact: true })).toBeVisible();

    await vision.click();
    await expect(architecture).toHaveAttribute("aria-expanded", "false");
    await expect(vision).toHaveAttribute("aria-expanded", "true");
    await vision.press("Escape");
    await expect(vision).toHaveAttribute("aria-expanded", "false");
    await expect(vision).toBeFocused();
  });

  test("reflows without horizontal overflow and removes motion when requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/experience");

    const technicalButton = page.getByRole("button", { name: "Technical", exact: true });
    const firstChapter = page.getByRole("button", { name: /Scientific workflow/i });

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
    ).toBe(true);
    expect((await technicalButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await firstChapter.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    expect(
      await page.locator(".experience-mode-switch__lens").evaluate((element) => getComputedStyle(element).transitionDuration)
    ).toBe("0s");
    expect(
      await page.locator(".experience-chapter__panel").first().evaluate((element) => getComputedStyle(element).transitionDuration)
    ).toBe("0s");
  });
});
