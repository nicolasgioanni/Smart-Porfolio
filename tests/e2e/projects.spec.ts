import { expect, test, type Locator, type Page } from "./browserTest";
import {
  captureBrowserConsole,
  expectNoBrowserConsoleIssues,
} from "./browserConsole";
import { readGeneratedPortfolioContent } from "./generatedContent";
import { settleLayout } from "./settleLayout";
import { selectThemeWithChooser } from "./themePreference";
import { selectProjectDetailContent } from "../../src/lib/content/selectDetailContent";
import {
  getProjectActions,
  getProjectDiagramAction,
  getProjectPreviewAction,
} from "../../src/features/projects/selectors/projectActions";
import { getProjectVisual } from "../../src/features/projects/selectors/projectVisualRegistry";

test.beforeEach(async ({ page }) => {
  captureBrowserConsole(page);
});

test.afterEach(async ({ page }) => {
  expectNoBrowserConsoleIssues(page);
});

function getProjectCards(page: Page): Locator {
  return page.locator("article.project-card--showcase");
}

function getSwitcher(card: Locator): Locator {
  return card.locator(".project-visual-switcher");
}

function getToggle(card: Locator): Locator {
  return getSwitcher(card).locator("button.project-visual-switcher__toggle");
}

function getTrack(card: Locator): Locator {
  return getSwitcher(card).locator(".project-visual-switcher__track");
}

function getMedia(card: Locator): Locator {
  return getSwitcher(card).locator(".project-visual-switcher__media");
}

function getPanels(card: Locator): Locator {
  return getSwitcher(card).locator(".project-visual-switcher__panel");
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

async function pageRelativeBox(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const pageContainer = document.querySelector(
      ".site-main > .page-container",
    );
    if (!pageContainer) throw new Error("Expected the project page container");
    const pageBox = pageContainer.getBoundingClientRect();
    return {
      height: box.height,
      width: box.width,
      x: box.x - pageBox.x,
      y: box.y - pageBox.y,
    };
  });
}

async function mediaOffsetWithinViewport(media: Locator) {
  return media.evaluate((element) => {
    const viewport = element.closest<HTMLElement>(
      ".project-visual-switcher__viewport",
    );
    if (!viewport) throw new Error("Expected project media inside its visual viewport.");
    const mediaBox = element.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    return {
      x: mediaBox.x - viewportBox.x,
      y: mediaBox.y - viewportBox.y,
    };
  });
}

async function expectCenteredToggle(card: Locator) {
  const [controls, toggle] = await Promise.all([
    pageRelativeBox(
      getSwitcher(card).locator(".project-visual-switcher__controls"),
    ),
    pageRelativeBox(getToggle(card)),
  ]);
  expect(Math.abs(controls.x + controls.width / 2 - (toggle.x + toggle.width / 2))).toBeLessThanOrEqual(1);
  expect(toggle.y + toggle.height).toBeLessThanOrEqual(
    controls.y + controls.height + 1,
  );
}

async function expectStableToggleDimensions(card: Locator) {
  const toggle = getToggle(card);
  const before = await pageRelativeBox(toggle);
  await toggle.click();
  await expect(getTrack(card)).toHaveAttribute("data-view", "workflow");
  const after = await pageRelativeBox(toggle);
  expect(Math.abs(before.width - after.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(before.height - after.height)).toBeLessThanOrEqual(1);
  expect(await toggle.evaluate((element) => (element as HTMLElement).offsetHeight)).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(getTrack(card)).toHaveAttribute("data-view", "preview");
}

async function expectPanelAccessibility(
  card: Locator,
  selected: "preview" | "workflow",
) {
  const panels = getPanels(card);
  await expect(panels).toHaveCount(2);

  const preview = panels.nth(0);
  const workflow = panels.nth(1);
  const active = selected === "preview" ? preview : workflow;
  const inactive = selected === "preview" ? workflow : preview;

  await expect(active).toHaveAttribute("aria-hidden", "false");
  await expect(active).not.toHaveAttribute("inert", "");
  await expect(inactive).toHaveAttribute("aria-hidden", "true");
  await expect(inactive).toHaveAttribute("inert", "");

  const outgoingLink = inactive.locator(
    "a.project-visual-switcher__media-link",
  );
  if (await outgoingLink.count()) {
    await expect(outgoingLink).toHaveJSProperty("tabIndex", 0);
    expect(
      await outgoingLink.evaluate((link) => {
        link.focus();
        return document.activeElement === link;
      }),
    ).toBe(false);
  }
}

async function expectPaintedPreviewFace(page: Page, card: Locator) {
  const previewImage = getPanels(card)
    .nth(0)
    .locator("img.project-visual-switcher__image");
  await previewImage.scrollIntoViewIfNeeded();
  const { objectFit, source } = await previewImage.evaluate((image) => ({
    objectFit: getComputedStyle(image).objectFit,
    source: (image as HTMLImageElement).currentSrc,
  }));
  const actual = await previewImage.screenshot();
  const difference = await page.evaluate(async ({ actual, objectFit, source }) => {
    const decode = async (encoded: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      return image;
    };
    const actualImage = await decode(actual);
    const expectedImage = new Image();
    expectedImage.src = source;
    await expectedImage.decode();
    const canvas = document.createElement("canvas");
    canvas.width = actualImage.width;
    canvas.height = actualImage.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Expected a 2D canvas context.");
    context.drawImage(actualImage, 0, 0);
    const actualPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = objectFit === "contain"
      ? Math.min(canvas.width / expectedImage.naturalWidth, canvas.height / expectedImage.naturalHeight)
      : Math.max(canvas.width / expectedImage.naturalWidth, canvas.height / expectedImage.naturalHeight);
    const width = expectedImage.naturalWidth * scale;
    const height = expectedImage.naturalHeight * scale;
    context.drawImage(expectedImage, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    const expectedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let samples = 0;
    let total = 0;
    for (let y = 8; y < canvas.height - 8; y += 8) {
      for (let x = 8; x < canvas.width - 8; x += 8) {
        const index = (y * canvas.width + x) * 4;
        total += Math.abs(actualPixels[index]! - expectedPixels[index]!);
        total += Math.abs(actualPixels[index + 1]! - expectedPixels[index + 1]!);
        total += Math.abs(actualPixels[index + 2]! - expectedPixels[index + 2]!);
        samples += 3;
      }
    }
    return total / samples;
  }, { actual: actual.toString("base64"), objectFit, source });
  expect(
    difference,
    "The selected preview image must paint instead of a workflow or blank face.",
  ).toBeLessThan(8);
}

async function expectDiagramLabelsContained(card: Locator) {
  const labels = card.locator(".project-diagram__label");
  await expect(labels).not.toHaveCount(0);
  await expect
    .poll(() =>
      labels.evaluateAll((elements) =>
        elements.every((label) => {
          const node = label.closest<HTMLElement>(".project-diagram__node");
          if (!node) return false;
          const labelBox = label.getBoundingClientRect();
          const nodeBox = node.getBoundingClientRect();
          return (
            labelBox.width > 0 &&
            labelBox.height > 0 &&
            label.scrollWidth <= label.clientWidth + 1 &&
            labelBox.left >= nodeBox.left - 1 &&
            labelBox.right <= nodeBox.right + 1 &&
            labelBox.top >= nodeBox.top - 1 &&
            labelBox.bottom <= nodeBox.bottom + 1
          );
        }),
      ),
    )
    .toBe(true);
}

async function expectLeetNotesPreviewContained(card: Locator) {
  const preview = getSwitcher(card).locator("figure.leetnotes-preview");
  await expect(preview).toBeVisible();
  await expect
    .poll(() =>
      preview.evaluate((frame) => {
        const frameBox = frame.getBoundingClientRect();
        const sheetHeading = frame.querySelector<HTMLElement>(
          ".leetnotes-preview__sheet-heading",
        );
        const sheetHeader = frame.querySelector<HTMLElement>(
          ".leetnotes-preview__sheet-row--header",
        );
        const selectedRow = frame.querySelector<HTMLElement>(
          ".leetnotes-preview__sheet-row--selected",
        );
        const files = frame.querySelector<HTMLElement>(
          ".leetnotes-preview__files",
        );
        const sync = frame.querySelector<HTMLElement>(
          ".leetnotes-preview__sync",
        );
        if (!sheetHeading || !sheetHeader || !selectedRow || !files || !sync)
          return false;

        const boxes = [sheetHeading, sheetHeader, selectedRow, files, sync].map(
          (element) => element.getBoundingClientRect(),
        );
        const contained = boxes.every(
          (box) =>
            box.width > 0 &&
            box.height > 0 &&
            box.left >= frameBox.left - 1 &&
            box.right <= frameBox.right + 1 &&
            box.top >= frameBox.top - 1 &&
            box.bottom <= frameBox.bottom + 1,
        );
        const selectedBox = selectedRow.getBoundingClientRect();
        const filesBox = files.getBoundingClientRect();
        const syncBox = sync.getBoundingClientRect();
        return (
          contained &&
          selectedBox.bottom <= filesBox.top + 1 &&
          filesBox.bottom <= syncBox.top + 1
        );
      }),
    )
    .toBe(true);
}

async function expectCardGeometryStableAcrossSwitch(
  card: Locator,
  viewportWidth: number,
) {
  const toggle = getToggle(card);
  const [
    cardBefore,
    titleBefore,
    viewportBefore,
    controlsBefore,
    actionsBefore,
  ] = await Promise.all([
    pageRelativeBox(card),
    pageRelativeBox(card.getByRole("heading")),
    pageRelativeBox(
      getSwitcher(card).locator(".project-visual-switcher__viewport"),
    ),
    pageRelativeBox(
      getSwitcher(card).locator(".project-visual-switcher__controls"),
    ),
    pageRelativeBox(card.locator(".project-card__actions")),
  ]);

  await toggle.click();
  await expect(getTrack(card)).toHaveAttribute("data-view", "workflow");
  const [cardAfter, titleAfter, viewportAfter, controlsAfter, actionsAfter] =
    await Promise.all([
      pageRelativeBox(card),
      pageRelativeBox(card.getByRole("heading")),
      pageRelativeBox(
        getSwitcher(card).locator(".project-visual-switcher__viewport"),
      ),
      pageRelativeBox(
        getSwitcher(card).locator(".project-visual-switcher__controls"),
      ),
      pageRelativeBox(card.locator(".project-card__actions")),
    ]);

  for (const [name, before, after] of [
    ["card", cardBefore, cardAfter],
    ["title", titleBefore, titleAfter],
    ["viewport", viewportBefore, viewportAfter],
    ["controls", controlsBefore, controlsAfter],
    ["actions", actionsBefore, actionsAfter],
  ] as const) {
    const message = `${name} for the project card at ${viewportWidth}px`;
    expect(Math.abs(before.x - after.x), message).toBeLessThanOrEqual(1);
    expect(Math.abs(before.y - after.y), message).toBeLessThanOrEqual(1);
    expect(Math.abs(before.width - after.width), message).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(before.height - after.height), message).toBeLessThanOrEqual(
      1,
    );
  }

  await toggle.click();
  await expect(getTrack(card)).toHaveAttribute("data-view", "preview");
}

async function sampledRotation(track: Locator) {
  return track.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    return { m11: matrix.m11, m13: matrix.m13, transform };
  });
}

async function reverseAtRenderedRotation(track: Locator, toggle: Locator) {
  const trackHandle = await track.elementHandle();
  if (!trackHandle) throw new Error("Expected a rendered project visual track.");

  return toggle.evaluate(async (button, trackElement) => {
    const sample = (element: Element) => {
      const transform = getComputedStyle(element).transform;
      const matrix = new DOMMatrixReadOnly(
        transform === "none" ? undefined : transform,
      );
      return { m11: matrix.m11, m13: matrix.m13, transform };
    };
    const before = sample(trackElement);
    (button as HTMLButtonElement).click();
    await Promise.resolve();
    return {
      after: sample(trackElement),
      before,
      view: (trackElement as HTMLElement).dataset.view,
    };
  }, trackHandle);
}

async function expectCardRowsAligned(left: Locator, right: Locator) {
  const readRows = async (card: Locator) =>
    card.evaluate((element) => {
      const readTop = (selector: string) => {
        const target = element.querySelector<HTMLElement>(selector);
        if (!target) throw new Error(`Missing ${selector}`);
        return target.getBoundingClientRect().top;
      };
      return {
        actions: readTop(".project-card__actions"),
        controls: readTop(".project-visual-switcher__controls"),
        header: readTop(".project-card__showcase-header"),
        visual: readTop(".project-visual-switcher__media"),
      };
    });
  const [leftRows, rightRows] = await Promise.all([readRows(left), readRows(right)]);
  for (const row of ["header", "visual", "controls", "actions"] as const) {
    expect(Math.abs(leftRows[row] - rightRows[row]), `${row} row should align across a desktop card pair`).toBeLessThanOrEqual(1);
  }
}

test.describe("Projects showcase", () => {
  test("renders the generated project order, real previews, safe inline credits, and source-first footer actions", async ({
    page,
  }) => {
    const projects = selectProjectDetailContent(
      readGeneratedPortfolioContent(),
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    await expect(cards).toHaveCount(projects.length);

    for (const [index, project] of projects.entries()) {
      const card = cards.nth(index);
      const visual = getProjectVisual(project.id);
      const actions = getProjectActions(project.links);

      await expect(
        card.getByRole("heading", { name: project.title }),
      ).toBeVisible();
      await expect(
        card
          .getByRole("link")
          .filter({ hasText: /^(Source code|Live demo|Download)$/ }),
      ).toHaveText(actions.map((action) => action.label));

      const footerDivider = card.locator(".project-card__footer-divider");
      await expect(footerDivider).toHaveCount(actions.length > 0 ? 1 : 0);
      if (actions.length > 0) {
        await expect(footerDivider).toHaveAttribute("aria-hidden", "true");
        const [dividerBox, actionsBox] = await Promise.all([
          footerDivider.boundingBox(),
          card.locator(".project-card__actions").boundingBox(),
        ]);
        expect(dividerBox).not.toBeNull();
        expect(actionsBox).not.toBeNull();
        expect(actionsBox!.y).toBeGreaterThanOrEqual(dividerBox!.y + dividerBox!.height - 1);
      }

      if (!visual) continue;

      const switcher = getSwitcher(card);
      await expect(switcher).toHaveAttribute("data-project-visual", project.id);
      await expect(switcher.getByRole("tab")).toHaveCount(0);
      await expect(switcher.getByRole("tablist")).toHaveCount(0);
      await expect(switcher.locator('[role="tabpanel"]')).toHaveCount(0);
      await expect(getToggle(card)).toHaveAccessibleName(
        `Show how ${project.title} works`,
      );
      await expect(
        getToggle(card).locator(".project-visual-switcher__toggle-label"),
      ).toHaveCount(2);
      await expect(
        getToggle(card).locator('.project-visual-switcher__toggle-label[data-view="preview"]'),
      ).toHaveText("Preview");
      await expect(
        getToggle(card).locator('.project-visual-switcher__toggle-label[data-view="workflow"]'),
      ).toHaveText("How it works");
      await expect(switcher.locator(".project-visual-switcher__hint")).toHaveCount(0);
      await expect(switcher.getByText(/Open (live site|source|download)/i)).toHaveCount(0);
      await expectCenteredToggle(card);
      await expectStableToggleDimensions(card);
      await expectPanelAccessibility(card, "preview");

      if (visual.badge) {
        const badge = card.locator(".project-card__badge");
        await expect(badge).toHaveText(new RegExp(visual.badge.label));
        await expect(badge).toHaveClass(
          new RegExp(`project-card__badge--${visual.badge.tone}`),
        );
      }

      const attribution = card.locator(
        ".project-card__showcase-header .content-card__summary > .project-card__attribution",
      );
      await expect(attribution).toHaveCount(visual.attribution ? 1 : 0);
      await expect(
        card.locator(".project-card__footer .project-card__attribution"),
      ).toHaveCount(0);
      if (visual.attribution) {
        const attributionLink = attribution.locator(".project-card__attribution-link");
        await expect(attributionLink).toHaveAccessibleName(visual.attribution.link.label);
        await expect(attributionLink).toHaveAttribute("href", visual.attribution.link.url);
        await expect(attributionLink).toHaveAttribute("target", "_blank");
        await expect(attributionLink).toHaveAttribute("rel", /noopener/);
      }

      if (visual.preview.kind === "leetnotes") {
        await expect(
          card.locator("figure.leetnotes-preview"),
        ).toBeVisible();
      } else {
        const image = card.getByRole("img", { name: visual.preview.alt });
        await image.scrollIntoViewIfNeeded();
        await expect(image).toHaveAttribute("src", visual.preview.src);
        await expect(image).toHaveAttribute(
          "width",
          String(visual.preview.width),
        );
        await expect(image).toHaveAttribute(
          "height",
          String(visual.preview.height),
        );
        await expect(image).toHaveCSS(
          "object-fit",
          visual.preview.kind === "screenshot" && visual.preview.mobile
            ? "cover"
            : "contain",
        );
        await expect
          .poll(() =>
            image.evaluate((element, expected) => {
              const rendered = element as HTMLImageElement;
              return (
                rendered.complete &&
                rendered.naturalWidth === expected.width &&
                rendered.naturalHeight === expected.height
              );
            }, { width: visual.preview.width, height: visual.preview.height }),
          )
          .toBe(true);
      }
    }

    const clairIndex = projects.findIndex((project) => project.id === "clair");
    if (clairIndex >= 0) {
      const clair = cards.nth(clairIndex);
      const download = getProjectActions(projects[clairIndex]!.links)
        .find((action) => action.label === "Download");
      const downloadLink = clair.getByRole("link", { name: "Download for Clair" });
      if (download) {
        await expect(downloadLink).toHaveAttribute("href", download.link.url);
      } else {
        await expect(downloadLink).toHaveCount(0);
      }
    }
  });

  test("starts every mount on the preview and keeps per-card switches independent and keyboard-operable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    const first = cards.first();
    const second = cards.nth(1);
    const firstToggle = getToggle(first);

    await firstToggle.focus();
    await page.keyboard.press("ArrowRight");
    await expect(getTrack(first)).toHaveAttribute("data-view", "workflow");
    await expect(firstToggle).toHaveAccessibleName("Show preview for Compliance Label Assistant");
    await expect(firstToggle).toBeFocused();
    await expectPanelAccessibility(first, "workflow");
    await expectDiagramLabelsContained(first);
    await expect(getTrack(second)).toHaveAttribute("data-view", "preview");

    await page.keyboard.press("Home");
    await expect(getTrack(first)).toHaveAttribute("data-view", "preview");
    await page.keyboard.press("End");
    await expect(getTrack(first)).toHaveAttribute("data-view", "workflow");
    await page.keyboard.press("ArrowLeft");
    await expect(getTrack(first)).toHaveAttribute("data-view", "preview");

    await firstToggle.press("Enter");
    await expect(getTrack(first)).toHaveAttribute("data-view", "workflow");
    await firstToggle.press("Space");
    await expect(getTrack(first)).toHaveAttribute("data-view", "preview");

    await firstToggle.click();
    await expect(getTrack(first)).toHaveAttribute("data-view", "workflow");
    await page.reload();
    await settleLayout(page);
    for (const card of await getProjectCards(page).all()) {
      await expect(getTrack(card)).toHaveAttribute("data-view", "preview");
      await expect(getToggle(card)).toHaveAccessibleName(/show how .* works/i);
    }
  });

  test("uses destination priority for clickable previews and never activates external providers in browser coverage", async ({
    page,
  }) => {
    const projects = selectProjectDetailContent(
      readGeneratedPortfolioContent(),
    );
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    for (const [index, project] of projects.entries()) {
      const visual = getProjectVisual(project.id);
      if (!visual) continue;
      const card = cards.nth(index);
      const previewAction = getProjectPreviewAction(project.links);
      const diagramAction = getProjectDiagramAction(project.links);
      const preview = getPanels(card)
        .nth(0)
        .locator("a.project-visual-switcher__media-link");

      if (previewAction) {
        await expect(preview).toHaveAttribute("href", previewAction.link.url);
        await expect(preview).toHaveAttribute("target", "_blank");
        await expect(preview).toHaveAttribute("rel", /noopener/);
      } else {
        await expect(preview).toHaveCount(0);
      }

      await getToggle(card).click();
      const workflow = getPanels(card)
        .nth(1)
        .locator("a.project-visual-switcher__media-link");
      if (diagramAction) {
        await expect(workflow).toHaveAttribute("href", diagramAction.link.url);
        await expect(workflow).toHaveAttribute("target", "_blank");
        await expect(workflow).toHaveAttribute("rel", /noopener/);
      } else {
        await expect(workflow).toHaveCount(0);
      }
      await getToggle(card).click();
    }
  });

  test("keeps titles, visual frames, actions, and the centered control fixed across views", async ({
    page,
  }) => {
    await page.goto("/projects");
    const cards = getProjectCards(page);

    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await settleLayout(page);
      for (const card of await cards.all()) {
        await expectCenteredToggle(card);
        await expectStableToggleDimensions(card);
        await expectCardGeometryStableAcrossSwitch(card, width);
      }
      await expectNoHorizontalOverflow(page);
    }
  });

  test("uses a 520ms reversible book flip in normal motion and switches immediately with reduced motion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const card = getProjectCards(page).first();
    const track = getTrack(card);
    const toggle = getToggle(card);
    await expect(track).toHaveCSS("transition-duration", "0.52s");
    await expect(track).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.65, 0, 0.35, 1)",
    );

    const previewTransform = await sampledRotation(track);
    for (const elapsed of [90, 260, 430]) {
      await expect(track).toHaveAttribute("data-view", "preview");
      await toggle.click();
      await expect(track).toHaveAttribute("data-view", "workflow");
      await page.waitForTimeout(elapsed);
      const outbound = await sampledRotation(track);
      expect(outbound.transform, `flip should be in flight at ${elapsed}ms`).not.toBe(previewTransform.transform);
      const reversal = await reverseAtRenderedRotation(track, toggle);
      expect(
        reversal.before.m11,
        `reversal from ${elapsed}ms should start at an intermediate face rotation`,
      ).toBeGreaterThan(-1);
      expect(
        reversal.before.m11,
        `reversal from ${elapsed}ms should start before the workflow endpoint`,
      ).toBeLessThan(1);
      expect(
        reversal.before.m13,
        `reversal from ${elapsed}ms should retain the negative rotateY direction`,
      ).toBeGreaterThan(0);
      expect(reversal.view).toBe("preview");
      expect(
        Math.abs(reversal.after.m11 - reversal.before.m11),
        `reversal from ${elapsed}ms should not snap the face`,
      ).toBeLessThanOrEqual(0.1);
      expect(
        Math.abs(reversal.after.m13 - reversal.before.m13),
        `reversal from ${elapsed}ms should preserve the current rotation axis`,
      ).toBeLessThanOrEqual(0.1);
      await page.waitForTimeout(50);
      const reversing = await sampledRotation(track);
      expect(reversing.transform, `reversal from ${elapsed}ms should retain the current flip position`).not.toBe(outbound.transform);
      expect(
        Math.abs(reversing.m11 - 1),
        `reversal from ${elapsed}ms should head back toward the preview face`,
      ).toBeLessThan(Math.abs(reversal.before.m11 - 1));
      await expect(track).toHaveAttribute("data-view", "preview");
      await page.waitForTimeout(560);
    }
    await toggle.click();
    await page.waitForTimeout(560);
    const workflowTransform = await sampledRotation(track);
    expect(workflowTransform.m11).toBeLessThan(-0.99);
    await toggle.click();
    await page.waitForTimeout(560);
    const restoredPreview = await sampledRotation(track);
    expect(restoredPreview.m11).toBeGreaterThan(0.99);
    expect(Math.abs(restoredPreview.m13)).toBeLessThan(0.01);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await toggle.click();
    await expect(track).toHaveAttribute("data-view", "workflow");
    await expect(track).toHaveCSS("transition-duration", "0s");
    await toggle.click();
    await expect(track).toHaveAttribute("data-view", "preview");
  });

  test("crossfades fixed-size labels and treats the rounded visual as one hoverable frame in every theme", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const card = getProjectCards(page).first();
    const toggle = getToggle(card);
    const previewLabel = toggle.locator('.project-visual-switcher__toggle-label[data-view="preview"]');
    const workflowLabel = toggle.locator('.project-visual-switcher__toggle-label[data-view="workflow"]');
    await expect(previewLabel).toHaveCSS("transition-duration", "0.18s");
    await expect(workflowLabel).toHaveCSS("transition-duration", "0.18s");
    await toggle.click();
    await page.waitForTimeout(80);
    for (const label of [previewLabel, workflowLabel]) {
      const opacity = Number(await label.evaluate((element) => getComputedStyle(element).opacity));
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
    }
    await page.waitForTimeout(140);
    await expect(previewLabel).toHaveCSS("opacity", "1");
    await expect(workflowLabel).toHaveCSS("opacity", "0");
    await toggle.click();

    const previewLink = getPanels(card)
      .nth(0)
      .locator("a.project-visual-switcher__media-link");
    await toggle.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(previewLink).toBeFocused();
    await expect
      .poll(() =>
        getMedia(card).evaluate(
          (element) => getComputedStyle(element, "::after").opacity,
        ),
      )
      .toBe("1");
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();

    for (const theme of ["navy", "light", "dark"] as const) {
      await selectThemeWithChooser(page, theme);
      const media = getMedia(card);
      await expect(media).toHaveCSS("transition-duration", "0.28s");
      await media.scrollIntoViewIfNeeded();
      const before = await mediaOffsetWithinViewport(media);
      await media.hover();
      await page.waitForTimeout(300);
      const after = await mediaOffsetWithinViewport(media);
      expect(after.y - before.y, `${theme} media should lift on hover`).toBeLessThanOrEqual(-2);
      const outline = await media.evaluate((element) => {
        const style = getComputedStyle(element, "::after");
        return {
          color: style.borderTopColor,
          opacity: style.opacity,
          width: style.borderTopWidth,
        };
      });
      expect(outline.width).toBe("2px");
      expect(outline.color).not.toBe("rgba(0, 0, 0, 0)");
      expect(outline.opacity).toBe("1");
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      const hiddenOutlineOpacity = await media.evaluate(
        (element) => getComputedStyle(element, "::after").opacity,
      );
      expect(hiddenOutlineOpacity).toBe("0");
      const returned = await mediaOffsetWithinViewport(media);
      expect(Math.abs(returned.y - before.y)).toBeLessThanOrEqual(1);
    }
  });

  test("aligns paired desktop card rows and keeps NotePal credit inline above divided actions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    for (let index = 0; index + 1 < (await cards.count()); index += 2) {
      await expectCardRowsAligned(cards.nth(index), cards.nth(index + 1));
    }

    const notePal = cards.filter({ has: page.locator('[data-project-visual="notepal"]') });
    const attribution = notePal.locator(
      ".project-card__showcase-header .content-card__summary > .project-card__attribution",
    );
    const attributionLink = attribution.locator(".project-card__attribution-link");
    const divider = notePal.locator(".project-card__footer-divider");
    await expect(attribution).toHaveCount(1);
    await expect(attributionLink).toHaveAccessibleName("Parth Gupta");
    await expect(attributionLink).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/parthgu/",
    );
    await expect(attributionLink).toHaveAttribute("target", "_blank");
    await expect(attributionLink).toHaveAttribute("rel", /noopener/);
    await expect(notePal.locator(".project-card__footer .project-card__attribution")).toHaveCount(0);
    await expect(divider).toHaveCount(1);
    await expect(divider).toHaveAttribute("aria-hidden", "true");

    const [attributionBox, dividerBox, actionsBox, footerBox] = await Promise.all([
      attribution.boundingBox(),
      divider.boundingBox(),
      notePal.locator(".project-card__actions").boundingBox(),
      notePal.locator(".project-card__footer").boundingBox(),
    ]);
    expect(attributionBox).not.toBeNull();
    expect(dividerBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    expect(attributionBox!.y).toBeLessThan(dividerBox!.y);
    expect(actionsBox!.y).toBeGreaterThanOrEqual(dividerBox!.y + dividerBox!.height - 1);
    expect(dividerBox!.x).toBeGreaterThan(footerBox!.x);
    expect(dividerBox!.x + dividerBox!.width).toBeLessThan(footerBox!.x + footerBox!.width);

    const inactiveColor = await attributionLink.evaluate((element) => getComputedStyle(element).color);
    await attributionLink.hover();
    await expect(attributionLink).toHaveCSS("text-decoration-line", "underline");
    const hoverColor = await attributionLink.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--color-accent-strong)";
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(attributionLink).toHaveCSS("color", hoverColor);
    expect(hoverColor).not.toBe(inactiveColor);

    await page.mouse.move(0, 0);
    await getPanels(notePal)
      .first()
      .locator("a.project-visual-switcher__media-link")
      .focus();
    await page.keyboard.press("Shift+Tab");
    await expect(attributionLink).toBeFocused();
    await expect(attributionLink).toHaveCSS("text-decoration-line", "underline");
    await expect(attributionLink).toHaveCSS("color", hoverColor);
  });

  test("keeps the two-column boundary, contained workflows, and three palette variants usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 981, height: 900 });
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    const firstWide = await cards.nth(0).boundingBox();
    const secondWide = await cards.nth(1).boundingBox();
    expect(firstWide).not.toBeNull();
    expect(secondWide).not.toBeNull();
    expect(Math.abs(firstWide!.y - secondWide!.y)).toBeLessThanOrEqual(1);
    expect(secondWide!.x).toBeGreaterThan(firstWide!.x);

    await page.setViewportSize({ width: 980, height: 900 });
    await settleLayout(page);
    const firstNarrow = await cards.nth(0).boundingBox();
    const secondNarrow = await cards.nth(1).boundingBox();
    expect(firstNarrow).not.toBeNull();
    expect(secondNarrow).not.toBeNull();
    expect(secondNarrow!.y).toBeGreaterThan(firstNarrow!.y + 1);

    const leetNotes = cards.filter({
      has: page.locator('[data-project-visual="leetnotes"]'),
    });
    const responsiveWidths = [320, 390, 720, 721, 980, 981, 1280] as const;
    for (const theme of ["navy", "light", "dark"] as const) {
      await selectThemeWithChooser(page, theme);
      for (const width of responsiveWidths) {
        await page.setViewportSize({ width, height: 900 });
        await settleLayout(page);
        for (const card of await cards.all()) {
          const viewport = getSwitcher(card).locator(".project-visual-switcher__viewport");
          const box = await viewport.boundingBox();
          expect(box).not.toBeNull();
          const ratio = box!.width / box!.height;
          const expectedRatio = width <= 720 ? 4 / 3 : 16 / 10;
          expect(Math.abs(ratio - expectedRatio), `${theme} visual ratio at ${width}px`).toBeLessThan(0.02);
          await expectCenteredToggle(card);
        }
        await expectNoHorizontalOverflow(page);
      }

      await page.setViewportSize({ width: 320, height: 844 });
      await expectLeetNotesPreviewContained(leetNotes);
      for (const card of await cards.all()) {
        await getToggle(card).click();
        await expectDiagramLabelsContained(card);
        await getToggle(card).click();
      }
      await expectNoHorizontalOverflow(page);

      // This is the effective layout width of a 1280px display at 200%
      // browser zoom. It exercises comparable responsive geometry, but does
      // not claim to emulate browser zoom's rendering pipeline.
      await page.setViewportSize({ width: 640, height: 900 });
      await settleLayout(page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("paints the selected preview after normal and reduced-motion view changes in Chromium", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Playwright WebKit screenshots mirror CSS 3D backfaces upstream.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/projects");
    await settleLayout(page);

    const card = getProjectCards(page).first();
    const track = getTrack(card);
    const toggle = getToggle(card);
    await expectPaintedPreviewFace(page, card);

    await toggle.click();
    await expect(track).toHaveAttribute("data-view", "workflow");
    await page.waitForTimeout(560);

    await toggle.click();
    await expect(track).toHaveAttribute("data-view", "preview");
    await page.waitForTimeout(560);
    await expectPaintedPreviewFace(page, card);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await toggle.click();
    await expect(track).toHaveAttribute("data-view", "workflow");
    await toggle.click();
    await expect(track).toHaveAttribute("data-view", "preview");
    await expectPaintedPreviewFace(page, card);
  });

  test("@mobile-projects keeps WebKit faces, touch switching, and keyboard focus usable on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/projects");
    await settleLayout(page);

    const cards = getProjectCards(page);
    const card = cards.first();
    const track = getTrack(card);
    const panels = getPanels(card);
    await expect(track).toHaveCSS("transform-style", "preserve-3d");
    for (const panel of await panels.all()) {
      await expect(panel).toHaveCSS("backface-visibility", "hidden");
    }

    const toggle = getToggle(card);
    await toggle.click();
    await expect(track).toHaveAttribute("data-view", "workflow");
    await expectPanelAccessibility(card, "workflow");
    await toggle.focus();
    await page.keyboard.press("Home");
    await expect(track).toHaveAttribute("data-view", "preview");
    await expect(toggle).toBeFocused();
    await expectPanelAccessibility(card, "preview");

    const mobilePictureSources = cards.locator(
      'picture source[media="(max-width: 720px)"]',
    );
    const mobileVisualCount = selectProjectDetailContent(
      readGeneratedPortfolioContent(),
    ).filter((project) => {
      const visual = getProjectVisual(project.id);
      return visual?.preview.kind === "screenshot" && Boolean(visual.preview.mobile);
    }).length;
    await expect(mobilePictureSources).toHaveCount(mobileVisualCount);
    for (const source of await mobilePictureSources.all()) {
      const picture = source.locator("..");
      const image = picture.locator("img");
      const sourceSet = await source.getAttribute("srcset");
      expect(sourceSet).not.toBeNull();
      const sourceUrl = sourceSet?.trim().split(/[\s,]/)[0] ?? "";
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate((element, sourceSet) => {
            const rendered = element as HTMLImageElement;
            return rendered.complete && rendered.currentSrc.includes(sourceSet);
          }, sourceUrl),
        )
        .toBe(true);
    }
    await expectNoHorizontalOverflow(page);
  });
});
