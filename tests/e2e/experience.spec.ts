import { expect, test } from "@playwright/test";

test.describe("Experience showcase", () => {
  test("switches audience depth and keeps one chapter open per role", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/experience");

    const cards = page.locator(".experience-card");
    const introSurface = page.locator(".page-intro__surface");
    const pageHeading = introSurface.getByRole("heading", { level: 1, name: "Experience" });
    const pageSummary = introSurface.getByText(/My experience spans AI engineering at the U\.S\. Treasury/);
    const modeGroup = introSurface.getByRole("group", { name: /Experience detail level/i });

    await expect(introSurface).toHaveCount(1);
    await expect(pageHeading).toBeVisible();
    await expect(pageSummary).toBeVisible();
    await expect(introSurface.getByText(/Detail level:/)).toBeVisible();
    await expect(cards).toHaveCount(5);
    await expect(modeGroup.getByRole("button", { name: "For everyone" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/Built and deployed CytoCV/)).toBeVisible();

    const [headingBox, summaryBox, modeBox, introBox] = await Promise.all([
      pageHeading.boundingBox(),
      pageSummary.boundingBox(),
      modeGroup.boundingBox(),
      introSurface.boundingBox()
    ]);
    expect(headingBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(modeBox).not.toBeNull();
    expect(introBox).not.toBeNull();
    expect(modeBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width);
    expect(modeBox!.y).toBeLessThan(summaryBox!.y);
    expect(modeBox!.x + modeBox!.width).toBeLessThanOrEqual(introBox!.x + introBox!.width);

    const treasuryCard = page
      .getByRole("heading", { level: 2, name: "AI Engineer" })
      .locator("xpath=ancestor::article");
    await expect(treasuryCard.getByText("Details not yet available.")).toBeVisible();
    await expect(treasuryCard.locator(".experience-chapter")).toHaveCount(0);

    await modeGroup.getByRole("button", { name: "Technical" }).click();
    await expect(modeGroup.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
    const liveStatus = introSurface.locator('[aria-live="polite"]');
    await expect(liveStatus).toHaveText("Showing technical details.");
    await expect(liveStatus).toHaveClass(/visually-hidden/);

    const cytocvCard = page
      .getByRole("heading", { level: 2, name: "Research Assistant (Software Engineering)" })
      .locator("xpath=ancestor::article");
    await expect(cytocvCard.getByText(/Architected a Django and JavaScript application/)).toBeVisible();
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
    const introSurface = page.locator(".page-intro__surface");
    const modeControl = introSurface.locator(".experience-mode-control");
    const modeLabel = modeControl.locator(".experience-mode-control__label");
    const modeSwitch = modeControl.locator(".experience-mode-switch");

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
    ).toBe(true);
    expect((await technicalButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await firstChapter.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    const [introBox, controlBox, labelBox, switchBox] = await Promise.all([
      introSurface.boundingBox(),
      modeControl.boundingBox(),
      modeLabel.boundingBox(),
      modeSwitch.boundingBox()
    ]);
    expect(introBox).not.toBeNull();
    expect(controlBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    expect(switchBox).not.toBeNull();
    expect(Math.abs(switchBox!.width - controlBox!.width)).toBeLessThanOrEqual(1);
    expect(switchBox!.x).toBeGreaterThanOrEqual(introBox!.x);
    expect(switchBox!.x + switchBox!.width).toBeLessThanOrEqual(introBox!.x + introBox!.width);
    expect(switchBox!.y).toBeGreaterThanOrEqual(labelBox!.y + labelBox!.height);

    expect(
      await page.locator(".experience-mode-switch__lens").evaluate((element) => getComputedStyle(element).transitionDuration)
    ).toBe("0s");
    expect(
      await page.locator(".experience-chapter__panel").first().evaluate((element) => getComputedStyle(element).transitionDuration)
    ).toBe("0s");
  });

  test("insets chapter dividers while preserving full-width hover targets", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/experience");

    const chapters = page.locator(".experience-card__chapters").first();
    const chapter = chapters.locator(".experience-chapter").first();
    const trigger = chapter.locator(".experience-chapter__trigger");
    const dividerInsets = await chapter.evaluate((element) => {
      const chaptersElement = element.parentElement!;
      const topDivider = getComputedStyle(chaptersElement, "::before");
      const rowDivider = getComputedStyle(element, "::before");
      const accentDivider = getComputedStyle(element, "::after");

      return {
        accentLeft: accentDivider.left,
        accentRight: accentDivider.right,
        rowLeft: rowDivider.left,
        rowRight: rowDivider.right,
        topLeft: topDivider.left,
        topRight: topDivider.right
      };
    });
    const [chapterBox, triggerBox] = await Promise.all([chapter.boundingBox(), trigger.boundingBox()]);

    expect(dividerInsets).toEqual({
      accentLeft: "4px",
      accentRight: "4px",
      rowLeft: "4px",
      rowRight: "4px",
      topLeft: "4px",
      topRight: "4px"
    });
    expect(chapterBox).not.toBeNull();
    expect(triggerBox).not.toBeNull();
    expect(Math.abs(chapterBox!.width - triggerBox!.width)).toBeLessThanOrEqual(1);
  });
});
