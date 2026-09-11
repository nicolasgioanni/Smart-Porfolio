import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectDisclosureFocusToKeepRestingElevation,
  findFirstExpandableCard
} from "./cardFocusElevation";
import { captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";
import { reloadWithStoredTheme } from "./themePreference";

const authoredAbstractProjectIds = [
  "cytocv-miller-lab",
  "adversarial-machine-learning",
  "yeast-dna-target-selection"
] as const;

test.beforeEach(async ({ page }) => {
  captureBrowserConsole(page);
});

test.afterEach(async ({ page }) => {
  expectNoBrowserConsoleIssues(page);
});

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

async function expectAuthoredAbstractTriggers(page: Page): Promise<Locator[]> {
  const allTriggers = page.locator("button.research-abstract__trigger");
  const triggers = [];

  await expect(allTriggers).toHaveCount(authoredAbstractProjectIds.length);
  for (const projectId of authoredAbstractProjectIds) {
    const project = page.locator(`article.research-project[id="${projectId}"]`);
    const trigger = project.locator("button.research-abstract__trigger");

    await expect(project).toHaveCount(1);
    await expect(trigger).toHaveCount(1);
    triggers.push(trigger);
  }

  return triggers;
}

async function expectDetailModeSwitch(page: Page) {
  const modeControl = page.locator(".detail-mode-control");
  const modeSwitch = modeControl.locator(".detail-mode-switch");
  const buttons = modeSwitch.getByRole("button");

  await expect(modeControl).toHaveCount(1);
  await expect(modeSwitch).toHaveCount(1);
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) {
    const buttonBox = await button.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
    expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
  }
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

async function expectVideoHeaderContained(project: Locator) {
  const geometry = await project.evaluate((projectElement) => {
    const visual = projectElement.querySelector<HTMLElement>(".research-project__visual");
    const header = projectElement.querySelector<HTMLElement>(".research-video__header");
    const actions = projectElement.querySelector<HTMLElement>(".research-video__actions");
    const controls = Array.from(actions?.querySelectorAll<HTMLElement>("a, button") ?? []);
    if (!visual || !header || !actions) throw new Error("CytoCV video header is missing its containment elements.");

    const visualBox = visual.getBoundingClientRect();
    return {
      actions: { clientWidth: actions.clientWidth, scrollWidth: actions.scrollWidth },
      controls: controls.map((control) => {
        const box = control.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
      header: { clientWidth: header.clientWidth, scrollWidth: header.scrollWidth },
      visual: { left: visualBox.left, right: visualBox.right }
    };
  });

  expect(geometry.header.scrollWidth).toBeLessThanOrEqual(geometry.header.clientWidth + 1);
  expect(geometry.actions.scrollWidth).toBeLessThanOrEqual(geometry.actions.clientWidth + 1);
  expect(geometry.controls).toHaveLength(3);
  for (const control of geometry.controls) {
    expect(control.left).toBeGreaterThanOrEqual(geometry.visual.left - 1);
    expect(control.right).toBeLessThanOrEqual(geometry.visual.right + 1);
  }
}

async function getFirstProjectWithDisclosure(projects: Locator): Promise<Locator | undefined> {
  const projectCount = await projects.count();

  for (let index = 0; index < projectCount; index += 1) {
    const project = projects.nth(index);
    if (await project.locator("button.detail-section__trigger").count()) return project;
  }

  return undefined;
}

async function expectRenderedCardIdentity(project: Locator, index: number) {
  const projectIndex = project.locator(".research-project__index");
  const organizationLogo = project.locator("img.research-project__organization-logo");
  const pendingResources = project.locator("button.research-project__resource--pending");

  await expect(projectIndex).toHaveText(String(index + 1).padStart(2, "0"));

  if (await organizationLogo.count()) {
    await expect(organizationLogo).toHaveCount(1);
    await expect(organizationLogo).toBeVisible();
    expect(await organizationLogo.getAttribute("alt")).toBeTruthy();
  }

  for (let pendingIndex = 0; pendingIndex < (await pendingResources.count()); pendingIndex += 1) {
    const pendingResource = pendingResources.nth(pendingIndex);
    const visibleLabel = (await pendingResource.textContent())?.trim() ?? "";

    await expect(pendingResource).toBeDisabled();
    await expect(pendingResource).toHaveAttribute("aria-label", /— not yet published$/);
    expect(visibleLabel).toBeTruthy();
    expect(visibleLabel).not.toMatch(/forthcoming/i);
  }
}

async function expectDialogFitsViewport(page: Page, dialog: Locator) {
  const dialogRoot = page.locator(".research-abstract-dialog");
  await expect(dialogRoot).toHaveAttribute("data-state", "open");
  const dialogSurface = await dialog.evaluate((frame) => {
    const styles = getComputedStyle(frame);

    return {
      backdropFilter: styles.backdropFilter,
      backgroundColor: styles.backgroundColor,
      backgroundImage: styles.backgroundImage
    };
  });

  expect(dialogSurface.backgroundColor).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
  expect(dialogSurface.backgroundImage).toBe("none");
  expect(dialogSurface.backdropFilter).toBe("none");
  await dialog.evaluate(async (frame) => {
    await Promise.all(frame.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });

  const viewport = page.viewportSize();
  const dialogBox = await dialog.boundingBox();
  const figure = dialog.locator(".research-abstract-dialog__figure");
  const image = dialog.locator(".research-abstract-dialog__image");
  const closeButton = dialog.locator(".research-abstract-dialog__close");
  const [figureBox, imageBox, closeBox, overflow] = await Promise.all([
    figure.boundingBox(),
    image.boundingBox(),
    closeButton.boundingBox(),
    dialog.evaluate((frame) => {
      const figureElement = frame.querySelector<HTMLElement>(".research-abstract-dialog__figure");
      const imageElement = frame.querySelector<HTMLImageElement>(".research-abstract-dialog__image");

      return {
        figure: figureElement
          ? {
              clientHeight: figureElement.clientHeight,
              clientWidth: figureElement.clientWidth,
              scrollHeight: figureElement.scrollHeight,
              scrollWidth: figureElement.scrollWidth
            }
          : null,
        frame: {
          clientHeight: frame.clientHeight,
          clientWidth: frame.clientWidth,
          scrollHeight: frame.scrollHeight,
          scrollWidth: frame.scrollWidth
        },
        image: imageElement
          ? {
              complete: imageElement.complete,
              naturalHeight: imageElement.naturalHeight,
              naturalWidth: imageElement.naturalWidth
            }
          : null
      };
    })
  ]);

  expect(viewport).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect(figureBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
  expect(figureBox!.x).toBeGreaterThanOrEqual(dialogBox!.x);
  expect(figureBox!.y).toBeGreaterThanOrEqual(dialogBox!.y);
  expect(figureBox!.x + figureBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width + 1);
  expect(figureBox!.y + figureBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1);
  expect(imageBox!.x).toBeGreaterThanOrEqual(figureBox!.x);
  expect(imageBox!.y).toBeGreaterThanOrEqual(figureBox!.y);
  expect(imageBox!.x + imageBox!.width).toBeLessThanOrEqual(figureBox!.x + figureBox!.width + 1);
  expect(imageBox!.y + imageBox!.height).toBeLessThanOrEqual(figureBox!.y + figureBox!.height + 1);
  expect(closeBox!.x).toBeGreaterThanOrEqual(dialogBox!.x);
  expect(closeBox!.y).toBeGreaterThanOrEqual(dialogBox!.y);
  expect(closeBox!.x + closeBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width + 1);
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1);
  expect(overflow.frame.scrollWidth).toBeLessThanOrEqual(overflow.frame.clientWidth + 1);
  expect(overflow.frame.scrollHeight).toBeLessThanOrEqual(overflow.frame.clientHeight + 1);
  expect(overflow.figure).not.toBeNull();
  expect(overflow.figure!.scrollWidth).toBeLessThanOrEqual(overflow.figure!.clientWidth + 1);
  expect(overflow.figure!.scrollHeight).toBeLessThanOrEqual(overflow.figure!.clientHeight + 1);
  expect(overflow.image).toMatchObject({ complete: true });
  expect(overflow.image!.naturalWidth).toBeGreaterThan(0);
  expect(overflow.image!.naturalHeight).toBeGreaterThan(0);
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

    for (let index = 0; index < (await projects.count()); index += 1) {
      await expectRenderedCardIdentity(projects.nth(index), index);
    }

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
    test.skip(!disclosureProject, "Legacy research content can legitimately omit expandable detail disclosures.");

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

  test("opens the three authored graphical abstracts in a fitted dialog and restores the exact trigger", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const abstractTriggers = await expectAuthoredAbstractTriggers(page);

    for (const trigger of abstractTriggers) {
      const thumbnail = trigger.locator(".research-abstract__thumbnail");
      await trigger.scrollIntoViewIfNeeded();
      await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(thumbnail).toHaveCSS("object-fit", "contain");
      await expect
        .poll(() =>
          thumbnail.evaluate(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalHeight > 0 &&
              (image as HTMLImageElement).naturalWidth > 0
          )
        )
        .toBe(true);

      await trigger.click();
      const dialog = page.getByRole("dialog", { name: /Graphical abstract for/ });
      await expect(dialog).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(dialog.locator(".research-abstract-dialog__image")).toHaveCSS("object-fit", "contain");
      await expectDialogFitsViewport(page, dialog);

      const closeButton = dialog.getByRole("button", { name: /Close graphical abstract for/ });
      await expect(closeButton).toBeFocused();
      await closeButton.click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    }

    const trigger = abstractTriggers[0]!;
    const dialog = page.getByRole("dialog", { name: /Graphical abstract for/ });

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.locator(".research-abstract-dialog").click({ position: { x: 2, y: 2 } });
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("supports keyboard activation, focus trapping, scroll locking, and rapid reopen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const trigger = (await expectAuthoredAbstractTriggers(page))[0]!;
    const originalBodyOverflow = await page.evaluate(() => document.body.style.overflow);

    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog", { name: /Graphical abstract for/ });
    const closeButton = dialog.getByRole("button", { name: /Close graphical abstract for/ });
    await expect(dialog).toBeVisible();
    await expect(closeButton).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(closeButton).toBeFocused();
    await trigger.focus();
    await expect(closeButton).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(originalBodyOverflow);

    await trigger.press("Space");
    await expect(dialog).toBeVisible();
    await page.locator(".research-abstract-dialog").click({ position: { x: 2, y: 2 } });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    await expect(dialog).toBeVisible();
    await closeButton.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.dispatchEvent("click");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("stacks rendered projects and detail controls without horizontal overflow on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/research");
    await settleLayout(page);

    const abstractTriggers = await expectAuthoredAbstractTriggers(page);
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

    const resourceTargets = await firstProject.locator(".research-project__resource").evaluateAll((resources) =>
      resources.map((resource) => resource.getBoundingClientRect().height)
    );
    for (const height of resourceTargets) expect(height).toBeGreaterThanOrEqual(44);

    for (const abstractTrigger of abstractTriggers) {
      const thumbnail = abstractTrigger.locator(".research-abstract__thumbnail");
      await abstractTrigger.scrollIntoViewIfNeeded();
      await expect(abstractTrigger).toHaveCSS("aspect-ratio", "16 / 9");
      await expect(thumbnail).toHaveCSS("object-fit", "contain");
      await expect
        .poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      await abstractTrigger.click();
      const dialog = page.getByRole("dialog", { name: /Graphical abstract for/ });
      await expect(dialog).toBeVisible();
      await expectDialogFitsViewport(page, dialog);
      await dialog.getByRole("button", { name: /Close graphical abstract for/ }).click();
      await expect(dialog).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("contains every abstract dialog in short desktop and mobile viewports", async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 600 },
      { width: 320, height: 568 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/research");
      await settleLayout(page);

      const abstractTriggers = await expectAuthoredAbstractTriggers(page);
      for (const trigger of abstractTriggers) {
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();

        const dialog = page.getByRole("dialog", { name: /Graphical abstract for/ });
        await expectDialogFitsViewport(page, dialog);
        await dialog.getByRole("button", { name: /Close graphical abstract for/ }).click();
        await expect(dialog).toHaveCount(0);
      }

      await expectNoHorizontalOverflow(page);
    }
  });

  test("honors the exact research layout breakpoints without overflow", async ({ page }) => {
    test.slow();
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const width of [921, 920, 621, 620]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/research");
      await settleLayout(page);

      const projects = await expectResearchProjectsOrEmptyState(page);
      await expectNoHorizontalOverflow(page);
      if (!projects) continue;

      const firstProject = projects.first();
      const [visualBox, contentBox] = await Promise.all([
        firstProject.locator(".research-project__visual").boundingBox(),
        firstProject.locator(".research-project__content").boundingBox()
      ]);
      expect(visualBox).not.toBeNull();
      expect(contentBox).not.toBeNull();

      if (width === 921) {
        expect(Math.abs(visualBox!.y - contentBox!.y)).toBeLessThanOrEqual(1);
        expect(visualBox!.x).toBeLessThan(contentBox!.x);
      } else {
        expect(visualBox!.y).toBeLessThan(contentBox!.y);
        expect(Math.abs(visualBox!.x - contentBox!.x)).toBeLessThanOrEqual(1);
      }

      if (width === 621 || width === 620) {
        const resources = firstProject.locator(".research-project__resources");
        if (await resources.count()) {
          await expect(resources).toHaveCSS("flex-direction", width === 620 ? "column" : "row");
        }
      }
    }
  });

  test("renders research visuals and abstract dialogs against solid surfaces in every palette", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const projects = await expectResearchProjectsOrEmptyState(page);
    if (!projects) return;

    for (const theme of ["navy", "light", "dark"] as const) {
      await reloadWithStoredTheme(page, theme);
      await settleLayout(page);
      const themedProjects = await expectResearchProjectsOrEmptyState(page);
      if (!themedProjects) throw new Error("Research projects disappeared after selecting a stored palette.");

      const visualSurfaces = await themedProjects
        .locator(".research-project__visual > :is(.research-visual, .research-abstract, .research-media-stack)")
        .evaluateAll((visuals) => {
        return visuals.map((visual) => {
          const styles = getComputedStyle(visual);
          return {
            backgroundColor: styles.backgroundColor,
            backgroundImage: styles.backgroundImage,
            opacity: styles.opacity
          };
        });
        });

      expect(visualSurfaces).toHaveLength(await themedProjects.count());
      for (const surface of visualSurfaces) {
        expect(surface.backgroundColor).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
        expect(surface.backgroundImage).toBe("none");
        expect(surface.opacity).toBe("1");
      }

      const trigger = (await expectAuthoredAbstractTriggers(page))[0]!;
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: /Graphical abstract for/ });
      await expectDialogFitsViewport(page, dialog);
      await expect(dialog).toHaveCSS("box-shadow", /rgba?\(/);
      await dialog.getByRole("button", { name: /Close graphical abstract for/ }).click();
      await expect(dialog).toBeHidden();
    }
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

    const abstractTrigger = (await expectAuthoredAbstractTriggers(page))[0]!;
    await expect(abstractTrigger).toHaveCSS("transition-duration", "0s");
    await abstractTrigger.click();
    const dialogRoot = page.locator(".research-abstract-dialog");
    await expect(dialogRoot).toHaveAttribute("data-reduced-motion", "true");
    await page.keyboard.press("Escape");
    await expect(dialogRoot).toBeHidden();

    const disclosureProject = await getFirstProjectWithDisclosure(projects);
    if (disclosureProject) {
      const disclosure = disclosureProject.locator("button.detail-section__trigger").first();
      await disclosure.click();
      const panelId = await disclosure.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      await expect(page.locator(`#${panelId}`)).toHaveCSS("transition-duration", "0s");
    }
  });

  test("keeps expanded projects at rest after focus and scrolling in every palette", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const projects = await expectResearchProjectsOrEmptyState(page);
    if (!projects) return;

    const project = await findFirstExpandableCard(projects);
    test.skip(!project, "Legacy research content can legitimately omit expandable detail disclosures.");

    await expectDisclosureFocusToKeepRestingElevation(page, project!);
  });

  test("keeps the CytoCV captioned video, header, and modal contained in every palette", async ({ page }) => {
    test.slow();

    await page.goto("/research");

    for (const viewport of [
      { width: 1280, height: 600 },
      { width: 320, height: 568 }
    ]) {
      for (const theme of ["navy", "light", "dark"] as const) {
        await page.setViewportSize(viewport);
        await reloadWithStoredTheme(page, theme);
        await settleLayout(page);

        const project = page.locator('article.research-project[id="cytocv-miller-lab"]');
        await expect(project).toHaveCount(1);
        const player = project.locator("video.research-video__player");
        const openButton = project.getByRole("button", { name: /Expand video for CytoCV/ });
        await expect(player).toHaveAttribute("controls", "");
        await expect(player).toHaveAttribute("preload", "metadata");
        await expect(player).toHaveAttribute("playsinline", "");
        await expect(player).not.toHaveAttribute("autoplay");
        await expect(player).not.toHaveAttribute("controlslist", /./);
        await expect(player).not.toHaveAttribute("disablepictureinpicture", /./);
        await expect(project.getByRole("link", { name: "Read transcript" })).toHaveAttribute(
          "href",
          "/images/research/cytocv-supplementary-video-s1-transcript.txt"
        );
        await expect(project.getByRole("link", { name: "Download MP4" })).toHaveAttribute("download", "");
        await expect
          .poll(() => player.evaluate((video) => (video as HTMLVideoElement).readyState >= HTMLMediaElement.HAVE_METADATA))
          .toBe(true);
        await expect(project.locator(".research-video__status")).toHaveCount(0);
        await expectVideoHeaderContained(project);

        await openButton.scrollIntoViewIfNeeded();
        await openButton.click();
        const dialog = page.getByRole("dialog", { name: "CytoCV supplementary workflow video" });
        const dialogPlayer = dialog.locator("video.research-video-dialog__player");
        const closeButton = dialog.getByRole("button", { name: /Close video for CytoCV/ });
        await expect(dialog).toBeVisible();
        await expect(closeButton).toBeFocused();
        await expect(dialogPlayer).toHaveAttribute("controls", "");
        await expect(dialogPlayer.locator("track")).toHaveAttribute(
          "src",
          "/images/research/cytocv-supplementary-video-s1.en.vtt"
        );
        await expect(dialog).toHaveCSS("background-image", "none");
        await expectNoHorizontalOverflow(page);

        const [dialogBox, viewportBox] = await Promise.all([
          dialog.boundingBox(),
          dialog.locator(".research-video-dialog__viewport").boundingBox()
        ]);
        expect(dialogBox).not.toBeNull();
        expect(viewportBox).not.toBeNull();
        expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
        expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
        expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height + 1);
        await closeButton.click();
        await expect(dialog).toHaveCount(0);
        await expect(openButton).toBeFocused();
        await expect(project.locator(".research-video__status")).toHaveCount(0);
      }
    }
  });
});
