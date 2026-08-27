import { expect, test, type Locator, type Page } from "@playwright/test";

async function settleLayout(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  });
}

async function expectResearchProjectsOrEmptyState(page: Page): Promise<Locator | undefined> {
  const projects = page.locator("article.research-project");

  if ((await projects.count()) === 0) {
    await expect(page.getByRole("status")).toContainText("Research entries will appear here when content is available.");
    return undefined;
  }

  return projects;
}

async function expectDetailModeSwitch(page: Page) {
  const modeControl = page.locator(".detail-mode-control");
  const modeSwitch = modeControl.locator(".detail-mode-switch");
  const buttons = modeSwitch.getByRole("button");

  await expect(modeControl).toHaveCount(1);
  await expect(modeSwitch).toHaveCount(1);
  await expect(buttons).toHaveCount(2);
  await expect.poll(() => buttons.evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-pressed"))))
    .toEqual(["true", "false"]);

  const initialMode = await modeSwitch.getAttribute("data-mode");
  expect(initialMode).toBeTruthy();
  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "false");
  await expect(modeSwitch).not.toHaveAttribute("data-mode", initialMode!);
  const liveStatus = modeControl.locator('[aria-live="polite"]');
  await expect(liveStatus).toHaveCount(1);
  await expect(liveStatus).toHaveText("Showing technical details.");
  await expect(liveStatus).toHaveClass(/visually-hidden/);

  return modeSwitch;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
    )
    .toBe(true);
}

async function getFirstProjectWithDisclosure(projects: Locator): Promise<Locator | undefined> {
  const projectCount = await projects.count();

  for (let index = 0; index < projectCount; index += 1) {
    const project = projects.nth(index);
    if (await project.locator("button.detail-section__trigger").count()) return project;
  }

  return undefined;
}

test.describe("Research showcase", () => {
  test("keeps alternating project rows and accessible technical disclosures", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const projects = await expectResearchProjectsOrEmptyState(page);
    if (!projects) {
      await expect(page.locator(".detail-mode-control")).toHaveCount(0);
      return;
    }
    await expectDetailModeSwitch(page);

    const desktopLayout = await projects.evaluateAll((cards) =>
      cards.map((card, index) => {
        const visual = card.querySelector<HTMLElement>(".research-project__visual")?.getBoundingClientRect();
        const content = card.querySelector<HTMLElement>(".research-project__content")?.getBoundingClientRect();

        return {
          contentX: content?.x,
          index,
          side: card.getAttribute("data-visual-side"),
          visualX: visual?.x
        };
      })
    );

    expect(desktopLayout.length).toBeGreaterThan(0);
    for (const { contentX, index, side, visualX } of desktopLayout) {
      expect(side).toBe(index % 2 === 0 ? "left" : "right");
      expect(visualX).toBeDefined();
      expect(contentX).toBeDefined();

      if (side === "left") {
        expect(visualX!).toBeLessThan(contentX!);
      } else {
        expect(contentX!).toBeLessThan(visualX!);
      }
    }

    const disclosureProject = await getFirstProjectWithDisclosure(projects);
    test.skip(!disclosureProject, "Research regression requires a project with an expandable detail disclosure.");

    const disclosures = disclosureProject!.locator("button.detail-section__trigger");
    const firstDisclosure = disclosures.first();
    await firstDisclosure.click();
    await expect(firstDisclosure).toHaveAttribute("aria-expanded", "true");
    const panelId = await firstDisclosure.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await expect(panel.getByRole("list").first()).toBeVisible();

    if (await disclosures.count() > 1) {
      const secondDisclosure = disclosures.nth(1);
      await secondDisclosure.click();
      await expect(firstDisclosure).toHaveAttribute("aria-expanded", "false");
      await expect(secondDisclosure).toHaveAttribute("aria-expanded", "true");
      await secondDisclosure.press("Escape");
      await expect(secondDisclosure).toHaveAttribute("aria-expanded", "false");
      await expect(secondDisclosure).toBeFocused();
    } else {
      await firstDisclosure.press("Escape");
      await expect(firstDisclosure).toHaveAttribute("aria-expanded", "false");
      await expect(firstDisclosure).toBeFocused();
    }
  });

  test("stacks rendered projects and detail controls without horizontal overflow on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/research");
    await settleLayout(page);

    const projects = await expectResearchProjectsOrEmptyState(page);

    await expectNoHorizontalOverflow(page);

    if (!projects) {
      await expect(page.locator(".detail-mode-control")).toHaveCount(0);
      return;
    }

    const modeControl = page.locator(".detail-mode-control");
    const modeSwitch = modeControl.locator(".detail-mode-switch");
    const firstProject = projects.first();

    await expect(modeControl).toBeVisible();

    const [controlBox, switchBox, visualBox, contentBox] = await Promise.all([
      modeControl.boundingBox(),
      modeSwitch.boundingBox(),
      firstProject.locator(".research-project__visual").boundingBox(),
      firstProject.locator(".research-project__content").boundingBox()
    ]);
    expect(controlBox).not.toBeNull();
    expect(switchBox).not.toBeNull();
    expect(visualBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(switchBox!.width).toBeLessThanOrEqual(controlBox!.width);
    expect(visualBox!.y).toBeLessThan(contentBox!.y);
    expect(Math.abs(visualBox!.x - contentBox!.x)).toBeLessThanOrEqual(1);
  });

  test("removes research detail transitions when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const projects = await expectResearchProjectsOrEmptyState(page);
    await expectNoHorizontalOverflow(page);

    if (!projects) {
      await expect(page.locator(".detail-mode-control")).toHaveCount(0);
      return;
    }

    await expectDetailModeSwitch(page);

    await expect(projects.locator(".research-project__body").first()).toHaveCSS("animation-name", "none");
    await expect(page.locator(".detail-mode-switch__lens")).toHaveCSS("transition-duration", "0s");

    const disclosureProject = await getFirstProjectWithDisclosure(projects);
    if (disclosureProject) {
      const disclosure = disclosureProject.locator("button.detail-section__trigger").first();
      await disclosure.click();
      const panelId = await disclosure.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      await expect(page.locator(`#${panelId}`)).toHaveCSS("transition-duration", "0s");
    }
  });
});
