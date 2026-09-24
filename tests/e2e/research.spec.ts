import { expect, test, type Locator, type Page } from "./browserTest";
import {
  expectDisclosureFocusToKeepRestingElevation,
  findFirstExpandableCard
} from "./cardFocusElevation";
import { captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";
import {
  expectDetailPanelScrollportFocusVisible,
  expectDetailPanelScrollportWithoutOverflow,
  expectDetailPanelClosingMotion,
  expectDetailPanelRapidReopen,
  expectStableDetailOverlay,
  getDetailPanelMotionSample,
  getDetailOverlaySample,
  sampleDetailOverlay,
  sampleDetailPanelMotion,
  sampleDetailPanelScrollport,
  settleDetailPanelMotion,
  settleDetailOverlayMotion
} from "./detailOverlay";
import {
  expectConnectedDetailSurfaceAcrossPalettes,
  expectConnectedDetailSurfaceResponsiveBoundary,
  expectReducedMotionConnectedDetailSurface
} from "./detailConnectedSurface";
import { expectDetailOutlineMotion, expectReducedMotionDetailOutline } from "./detailOutline";
import { settleLayout, settlePageEntryMotion } from "./settleLayout";
import { reloadWithStoredTheme } from "./themePreference";


test.beforeEach(async ({ page }) => {
  captureBrowserConsole(page);
});

test.afterEach(async ({ page }) => {
  expectNoBrowserConsoleIssues(page);
});

async function expectResearchProjectsOrEmptyState(page: Page): Promise<Locator | undefined> {
  const projects = page.locator("article.research-project");

  if ((await projects.count()) === 0) {
    await expect(page.getByRole("status")).toContainText("Research entries will appear here when content is available.");
    return undefined;
  }

  return projects;
}

async function getRenderedAbstractTriggers(page: Page): Promise<Locator[]> {
  const allTriggers = page.locator("button.research-abstract__trigger");
  return Array.from({ length: await allTriggers.count() }, (_, index) =>
    allTriggers.nth(index),
  );
}

async function expectResolverOwnedMediaTitles(projects: Locator) {
  const media = projects.locator(".research-video, .research-abstract");
  const mediaCount = await media.count();

  if (mediaCount === 0) return;

  await expect(media.locator(".research-media-title")).toHaveCount(mediaCount);
  for (let index = 0; index < mediaCount; index += 1) {
    const currentMedia = media.nth(index);
    const title = currentMedia.locator(".research-media-title");
    const geometry = await title.evaluate((titleElement) => {
      const mediaElement = titleElement.closest<HTMLElement>(".research-video, .research-abstract");
      const mediumSelector = mediaElement?.classList.contains("research-video")
        ? ".research-video__viewport"
        : ".research-abstract__trigger";
      const renderedMedium = mediaElement?.querySelector<HTMLElement>(mediumSelector);
      const titleBox = titleElement.getBoundingClientRect();
      const mediumBox = renderedMedium?.getBoundingClientRect();

      return {
        clientWidth: titleElement.clientWidth,
        mediumTop: mediumBox?.top,
        scrollWidth: titleElement.scrollWidth,
        text: titleElement.textContent?.trim() ?? "",
        titleBottom: titleBox.bottom
      };
    });

    expect(geometry.text.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(geometry.text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(3);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.mediumTop).toBeDefined();
    expect(geometry.titleBottom).toBeLessThanOrEqual(geometry.mediumTop! + 1);
  }
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
    // Device-pixel rounding can report a 44px CSS target as 43.99998px.
    expect(buttonBox!.width).toBeGreaterThanOrEqual(43.99);
    expect(buttonBox!.height).toBeGreaterThanOrEqual(43.99);
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

async function getRenderedResearchExplainers(page: Page): Promise<Locator[]> {
  const explainers = page.locator("[data-research-explainer]");
  return Array.from({ length: await explainers.count() }, (_, index) =>
    explainers.nth(index),
  );
}

type ExplainerCinematicContract = {
  labels: readonly string[];
  phaseSubjects: readonly string[];
  title: string;
};

const explainerCinematicContracts = {
  aml: {
    labels: [
      "Clean image",
      "Altered copy",
      "Train with both",
      "Binary detector",
      "Test image",
      "Clean or manipulated?",
    ],
    phaseSubjects: [
      ".research-explainer__pixel-patches",
      ".research-explainer__data-token",
      ".research-explainer__detector-ring",
      ".research-explainer__test-token",
    ],
    title: "Can AI spot an altered image?",
  },
  "guide-donor": {
    labels: [
      "Target DNA",
      "A → G",
      "Guide site",
      "Donor design",
      "Export designs",
      "Guide",
      "Donor",
    ],
    phaseSubjects: [
      ".research-explainer__change-marker--requested",
      ".research-explainer__guide-bracket",
      ".research-explainer__donor-token",
      ".research-explainer__export-token",
    ],
    title: "Design a DNA change",
  },
} as const satisfies Record<string, ExplainerCinematicContract>;

function getExplainerCinematicContract(
  variant: string | null,
): ExplainerCinematicContract {
  const contract = variant
    ? explainerCinematicContracts[
        variant as keyof typeof explainerCinematicContracts
      ]
    : undefined;
  if (!contract) {
    throw new Error(`Unexpected Research explainer variant: ${variant}`);
  }
  return contract;
}

async function expectResearchExplainerStaticContent(
  explainer: Locator,
): Promise<ExplainerCinematicContract> {
  const variant = await explainer.getAttribute("data-research-explainer");
  const contract = getExplainerCinematicContract(variant);
  await expect(explainer).toHaveAttribute("data-research-explainer", variant!);
  await expect(explainer.locator(".research-explainer__title")).toHaveText(
    contract.title,
  );
  await expect(explainer.locator(".research-explainer__scene")).toHaveCount(1);
  await expect(explainer.locator(".research-explainer__scene")).toBeVisible();
  await expect(
    explainer.locator("svg.research-explainer__diagram"),
  ).toHaveCount(1);
  await expect(
    explainer.locator("svg.research-explainer__diagram"),
  ).toBeVisible();
  await expect(explainer.locator(".research-explainer__caption")).toBeVisible();
  await expect(
    explainer.locator(".research-explainer__caption"),
  ).not.toBeEmpty();
  const sceneLabels = explainer.locator(
    ".research-explainer__scene-labels",
  );
  await expect(
    sceneLabels.locator(".research-explainer__scene-label"),
  ).toHaveCount(contract.labels.length);
  const labelText = await sceneLabels
    .locator(".research-explainer__scene-label")
    .evaluateAll((labels) =>
      labels.map((label) =>
        (label instanceof HTMLElement ? label.innerText : label.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    );
  expect(labelText).toEqual(contract.labels);

  const phases = await explainer
    .locator(".research-explainer__phase")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        className: element.getAttribute("class") ?? "",
        opacity: Number.parseFloat(getComputedStyle(element).opacity),
        visibility: getComputedStyle(element).visibility,
      })),
    );
  expect(phases).toHaveLength(4);
  expect(phases.map((phase) => phase.className)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("research-explainer__phase--one"),
      expect.stringContaining("research-explainer__phase--two"),
      expect.stringContaining("research-explainer__phase--three"),
      expect.stringContaining("research-explainer__phase--four"),
    ]),
  );
  for (const phase of phases) {
    expect(phase.visibility).toBe("visible");
    expect(phase.opacity).toBeGreaterThan(0);
  }

  return contract;
}

async function expectExplainerSceneVisibleAtEveryPhase(
  explainer: Locator,
  contract: ExplainerCinematicContract,
) {
  const samples = await explainer.evaluate((root, options) => {
    const phases = Array.from(
      root.querySelectorAll<HTMLElement>(".research-explainer__phase"),
    );
    const labels = Array.from(
      root.querySelectorAll<HTMLElement>(".research-explainer__scene-label"),
    );
    const scene = root.querySelector<HTMLElement>(".research-explainer__scene");
    const animations = root
      .getAnimations({ subtree: true })
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return (
          target instanceof Element &&
          (target.matches(options.subjectSelector) ||
            Boolean(target.closest(options.subjectSelector)))
        );
      });
    const animationsByPhase = options.phaseSubjects.map((selector) =>
      animations.filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return (
          target instanceof Element &&
          (target.matches(selector) || Boolean(target.closest(selector)))
        );
      }),
    );
    if (
      phases.length !== 4 ||
      !scene ||
      labels.length !== options.labelCount ||
      animationsByPhase.some((phaseAnimations) => phaseAnimations.length === 0)
    ) {
      throw new Error(
        "Research explainer must keep four persistent phases, its connected scene, visible HTML labels, and an animated subject for each phase.",
      );
    }

    const snapshots = [1_500, 4_600, 7_500, 10_200, 11_500].map((time) => {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = time;
      }
      return {
        animationCounts: animationsByPhase.map(
          (phaseAnimations) => phaseAnimations.length,
        ),
        animationDurations: animations.map((animation) => {
          const target = (animation.effect as KeyframeEffect).target as Element;
          return getComputedStyle(target).animationDuration;
        }),
        animationTimes: animations.map((animation) =>
          Number(animation.currentTime ?? -1),
        ),
        labels: labels.map((label) => {
          const style = getComputedStyle(label);
          const box = label.getBoundingClientRect();
          return {
            height: box.height,
            opacity: Number.parseFloat(style.opacity),
            visibility: style.visibility,
            width: box.width,
          };
        }),
        phases: phases.map((phase) => {
          const style = getComputedStyle(phase);
          return {
            opacity: Number.parseFloat(style.opacity),
            visibility: style.visibility,
          };
        }),
        subjects: options.phaseSubjects.map((selector) =>
          Array.from(root.querySelectorAll<HTMLElement>(selector)).map(
            (subject) => {
              const style = getComputedStyle(subject);
              const box = subject.getBoundingClientRect();
              return {
                height: box.height,
                opacity: Number.parseFloat(style.opacity),
                transform: style.transform,
                visibility: style.visibility,
                width: box.width,
              };
            },
          ),
        ),
      };
    });
    let guideExportPathSample: {
      closestPathDistance: number;
      opacity: number;
      visibility: string;
    } | undefined;
    if (options.variant === "guide-donor") {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = 9_720;
      }
      const svg = root.querySelector<SVGSVGElement>(
        "svg.research-explainer__diagram",
      );
      const guideToken = root.querySelector<SVGCircleElement>(
        ".research-explainer__export-token--guide",
      );
      const guidePath = root.querySelector<SVGPathElement>(
        ".research-explainer__export-path",
      );
      if (!svg || !guideToken || !guidePath) {
        throw new Error(
          "GuideDonorScheduler needs a guide export token and visible path.",
        );
      }
      const svgBox = svg.getBoundingClientRect();
      const tokenBox = guideToken.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      const tokenCenter = {
        x:
          viewBox.x +
          ((tokenBox.left + tokenBox.width / 2 - svgBox.left) / svgBox.width) *
            viewBox.width,
        y:
          viewBox.y +
          ((tokenBox.top + tokenBox.height / 2 - svgBox.top) / svgBox.height) *
            viewBox.height,
      };
      const totalLength = guidePath.getTotalLength();
      let closestPathDistance = Number.POSITIVE_INFINITY;
      for (let step = 0; step <= 200; step += 1) {
        const point = guidePath.getPointAtLength((totalLength * step) / 200);
        closestPathDistance = Math.min(
          closestPathDistance,
          Math.hypot(point.x - tokenCenter.x, point.y - tokenCenter.y),
        );
      }
      const style = getComputedStyle(guideToken);
      guideExportPathSample = {
        closestPathDistance,
        opacity: Number.parseFloat(style.opacity),
        visibility: style.visibility,
      };
    }
    for (const animation of animations) animation.play();
    return { guideExportPathSample, snapshots };
  }, {
    labelCount: contract.labels.length,
    phaseSubjects: contract.phaseSubjects,
    subjectSelector: contract.phaseSubjects.join(", "),
    variant: await explainer.getAttribute("data-research-explainer"),
  });

  expect(samples.snapshots).toHaveLength(5);
  for (const [sampleIndex, sample] of samples.snapshots.entries()) {
    expect(sample.phases).toHaveLength(4);
    expect(sample.labels).toHaveLength(contract.labels.length);
    expect(sample.animationCounts).toHaveLength(4);
    expect(sample.animationCounts.every((count) => count > 0)).toBe(true);
    expect(sample.animationDurations.every((duration) => duration === "12s")).toBe(
      true,
    );
    expect(
      sample.animationTimes.every(
        (time) => Math.abs(time - [1_500, 4_600, 7_500, 10_200, 11_500][sampleIndex]!) <= 1,
      ),
    ).toBe(true);
    for (const phase of sample.phases) {
      expect(phase.visibility).toBe("visible");
      expect(phase.opacity).toBeGreaterThan(0);
    }
    for (const label of sample.labels) {
      expect(label.visibility).toBe("visible");
      expect(label.opacity).toBeGreaterThan(0);
      expect(label.width).toBeGreaterThan(0);
      expect(label.height).toBeGreaterThan(0);
    }
    for (const phaseSubjects of sample.subjects) {
      expect(phaseSubjects.length).toBeGreaterThan(0);
      for (const subject of phaseSubjects) {
        expect(subject.visibility).toBe("visible");
        expect(subject.width).toBeGreaterThan(0);
        expect(subject.height).toBeGreaterThan(0);
      }
    }
    if (sampleIndex < 4) {
      const emphasizedSubject = sample.subjects[sampleIndex]!;
      expect(
        emphasizedSubject.some(
          (subject) => subject.opacity > 0,
        ),
      ).toBe(true);
      expect(
        emphasizedSubject.some(
          (subject) => subject.transform !== "none" || subject.opacity < 0.99,
        ),
      ).toBe(true);
    }
  }
  if (samples.guideExportPathSample) {
    expect(samples.guideExportPathSample.visibility).toBe("visible");
    expect(samples.guideExportPathSample.opacity).toBeGreaterThan(0);
    expect(samples.guideExportPathSample.closestPathDistance).toBeLessThanOrEqual(
      6,
    );
  }
}

async function sampleExplainerTimeline(
  explainer: Locator,
  selector: string,
  frames = 0,
): Promise<number[]> {
  return explainer.evaluate(async (root, options) => {
    for (let frame = 0; frame < options.frames; frame += 1) {
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
    }
    return root
      .getAnimations({ subtree: true })
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return (
          target instanceof Element &&
          (target.matches(options.selector) ||
            Boolean(target.closest(options.selector)))
        );
      })
      .map((animation) => Number.parseFloat(String(animation.currentTime ?? -1)));
  }, { frames, selector });
}

async function getExplainerAnimationStyles(
  explainer: Locator,
  selector: string,
) {
  return explainer.evaluate((root, targetSelector) =>
    root
      .getAnimations({ subtree: true })
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return (
          target instanceof Element &&
          (target.matches(targetSelector) ||
            Boolean(target.closest(targetSelector)))
        );
      })
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect).target as Element;
        const style = getComputedStyle(target);
        return {
          animationDuration: style.animationDuration,
          animationName: style.animationName,
          playState: style.animationPlayState,
        };
      }),
  selector);
}

async function waitForExplainerTimelineToFreeze(explainer: Locator, selector: string) {
  await expect.poll(async () => {
    const start = await sampleExplainerTimeline(explainer, selector);
    const next = await sampleExplainerTimeline(explainer, selector, 2);
    return next.every((time, index) => Math.abs(time - start[index]!) <= 1);
  }).toBe(true);
}

async function setDocumentVisibilityForTest(page: Page, hidden: boolean) {
  await page.evaluate((nextHidden) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => nextHidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

async function expectAbstractFrameGeometry(trigger: Locator) {
  await trigger.scrollIntoViewIfNeeded();
  const geometry = await trigger.evaluate((triggerElement) => {
    const abstract = triggerElement.closest<HTMLElement>(".research-abstract");
    const row = abstract?.closest<HTMLElement>(
      ".research-project__media-row--abstract",
    );
    const title = abstract?.querySelector<HTMLElement>(
      ".research-abstract__title",
    );
    const thumbnail = triggerElement.querySelector<HTMLImageElement>(
      ".research-abstract__thumbnail",
    );
    if (!abstract || !row || !title || !thumbnail)
      throw new Error(
        "The graphical abstract is missing its titled frame, media row, or thumbnail.",
      );

    const abstractBox = abstract.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const triggerBox = triggerElement.getBoundingClientRect();
    const thumbnailBox = thumbnail.getBoundingClientRect();
    const thumbnailStyles = getComputedStyle(thumbnail);
    const titleBox = title.getBoundingClientRect();

    return {
      abstract: {
        clientWidth: abstract.clientWidth,
        scrollWidth: abstract.scrollWidth,
      },
      row: {
        left: abstractBox.left - rowBox.left,
        paddingLeft: getComputedStyle(row).paddingLeft,
        paddingRight: getComputedStyle(row).paddingRight,
        right: rowBox.right - abstractBox.right,
      },
      title: { triggerTopAfterTitle: triggerBox.top - titleBox.bottom },
      rowGap: Number.parseFloat(getComputedStyle(abstract).rowGap),
      thumbnail: {
        height: thumbnailBox.height,
        naturalHeight: thumbnail.naturalHeight,
        naturalWidth: thumbnail.naturalWidth,
        objectFit: thumbnailStyles.objectFit,
        width: thumbnailBox.width,
      },
      trigger: {
        clientHeight: triggerElement.clientHeight,
        clientWidth: triggerElement.clientWidth,
        height: triggerBox.height,
        scrollWidth: triggerElement.scrollWidth,
        width: triggerBox.width,
      },
    };
  });

  expect(geometry.row.paddingLeft).toBe("16px");
  expect(geometry.row.paddingRight).toBe("16px");
  expect(Math.abs(geometry.row.left - geometry.row.right)).toBeLessThanOrEqual(
    1,
  );
  expect(geometry.trigger.height).toBeGreaterThan(0);
  expect(geometry.title.triggerTopAfterTitle).toBeCloseTo(geometry.rowGap, 0);
  expect(geometry.trigger.width).toBeCloseTo(geometry.abstract.clientWidth, 0);
  expect(geometry.trigger.scrollWidth).toBeLessThanOrEqual(
    geometry.trigger.width + 1,
  );
  expect(geometry.abstract.scrollWidth).toBeLessThanOrEqual(
    geometry.abstract.clientWidth + 1,
  );
  expect(geometry.thumbnail.objectFit).toBe("contain");
  expect(geometry.thumbnail.naturalWidth).toBeGreaterThan(0);
  expect(geometry.thumbnail.naturalHeight).toBeGreaterThan(0);
  expect(geometry.thumbnail.width).toBeCloseTo(geometry.trigger.clientWidth, 0);
  expect(geometry.thumbnail.height).toBeCloseTo(
    geometry.trigger.clientHeight,
    0,
  );
}

async function expectCustomPlayerContained(player: Locator) {
  await expect(player).toHaveAttribute("data-enhanced", "true");

  const geometry = await player.evaluate((playerElement) => {
    const playerBox = playerElement.getBoundingClientRect();
    const video = playerElement.querySelector<HTMLVideoElement>("video");
    if (!video) throw new Error("The custom Research player must retain its native video fallback.");

    const videoBox = video.getBoundingClientRect();
    const bottomBar = playerElement.querySelector<HTMLElement>("[data-testid='research-video-bottom-controls']")?.getBoundingClientRect();
    const centerControl = playerElement.querySelector<HTMLElement>(".research-video-player__center-control")?.getBoundingClientRect();
    const timeline = playerElement.querySelector<HTMLElement>(".research-video-player__timeline-row")?.getBoundingClientRect();
    const seek = playerElement.querySelector<HTMLInputElement>('input[aria-label="Seek video"]')?.getBoundingClientRect();
    const time = playerElement.querySelector<HTMLElement>(".research-video-player__time")?.getBoundingClientRect();
    const actions = playerElement.querySelector<HTMLElement>(".research-video-player__actions")?.getBoundingClientRect();
    const actionsLeft = playerElement.querySelector<HTMLElement>(".research-video-player__actions-left")?.getBoundingClientRect();
    const actionsRight = playerElement.querySelector<HTMLElement>(".research-video-player__actions-right")?.getBoundingClientRect();
    const controls = Array.from(playerElement.querySelectorAll<HTMLButtonElement>("button.research-video-player__control")).filter(
      (control) => !control.hidden && !control.closest("[hidden], [aria-hidden=true], [inert]")
    );
    return {
      controls: controls.map((control) => {
        const box = control.getBoundingClientRect();
        const icon = control.querySelector("svg")?.getBoundingClientRect();
        return {
          height: box.height,
          iconCenterY: icon ? icon.y + icon.height / 2 : null,
          left: box.left,
          right: box.right,
          verticalCenterY: box.y + box.height / 2,
          width: box.width
        };
      }),
      bottomBar: bottomBar
        ? { bottom: bottomBar.bottom, height: bottomBar.height, left: bottomBar.left, right: bottomBar.right, top: bottomBar.top, width: bottomBar.width }
        : null,
      center: centerControl
        ? { x: centerControl.x + centerControl.width / 2, y: centerControl.y + centerControl.height / 2 }
        : null,
      player: { clientWidth: playerElement.clientWidth, scrollWidth: playerElement.scrollWidth },
      playerBox: { bottom: playerBox.bottom, left: playerBox.left, right: playerBox.right, top: playerBox.top },
      seek: seek ? { centerY: seek.y + seek.height / 2 } : null,
      time: time ? { centerY: time.y + time.height / 2 } : null,
      timeline: timeline ? { top: timeline.top } : null,
      actions: actions ? { top: actions.top } : null,
      actionsLeft: actionsLeft ? { left: actionsLeft.left, right: actionsLeft.right } : null,
      actionsRight: actionsRight ? { left: actionsRight.left, right: actionsRight.right } : null,
      video: { bottom: videoBox.bottom, left: videoBox.left, right: videoBox.right, top: videoBox.top }
    };
  });

  expect(geometry.player.scrollWidth).toBeLessThanOrEqual(geometry.player.clientWidth + 1);
  expect(geometry.video.left).toBeGreaterThanOrEqual(geometry.playerBox.left - 1);
  expect(geometry.video.right).toBeLessThanOrEqual(geometry.playerBox.right + 1);
  expect(geometry.video.top).toBeGreaterThanOrEqual(geometry.playerBox.top - 1);
  expect(geometry.video.bottom).toBeLessThanOrEqual(geometry.playerBox.bottom + 1);
  expect(geometry.bottomBar?.height).toBeGreaterThanOrEqual(60);
  expect(geometry.bottomBar?.height).toBeLessThanOrEqual(74);
  expect(geometry.bottomBar?.left).toBeGreaterThanOrEqual(geometry.playerBox.left - 1);
  expect(geometry.bottomBar?.right).toBeLessThanOrEqual(geometry.playerBox.right + 1);
  expect(Math.abs((geometry.seek?.centerY ?? 0) - (geometry.time?.centerY ?? 0))).toBeLessThanOrEqual(1);
  expect(geometry.actions?.top).toBeGreaterThanOrEqual(geometry.timeline?.top ?? 0);
  expect(geometry.actionsLeft?.left).toBeLessThanOrEqual(geometry.actionsRight?.left ?? Number.POSITIVE_INFINITY);
  expect(geometry.actionsLeft?.right).toBeLessThanOrEqual((geometry.actionsRight?.right ?? 0) + 1);
  expect(geometry.center?.x).toBeCloseTo((geometry.playerBox.left + geometry.playerBox.right) / 2, 0);
  expect(geometry.center?.y).toBeCloseTo((geometry.playerBox.top + geometry.playerBox.bottom) / 2, 0);
  for (const control of geometry.controls) {
    // Browser transforms during modal entry can expose an otherwise exact
    // 44px CSS target as a fractional physical-pixel rectangle.
    expect(control.width).toBeGreaterThanOrEqual(43.99);
    expect(control.height).toBeGreaterThanOrEqual(43.99);
    expect(control.left).toBeGreaterThanOrEqual(geometry.playerBox.left - 1);
    expect(control.right).toBeLessThanOrEqual(geometry.playerBox.right + 1);
    if (control.iconCenterY !== null) {
      expect(Math.abs(control.iconCenterY - control.verticalCenterY)).toBeLessThanOrEqual(1);
    }
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

async function getExpandableResearchProjectIndexes(projects: Locator): Promise<number[]> {
  const indexes: number[] = [];

  for (let index = 0; index < (await projects.count()); index += 1) {
    if (await projects.nth(index).locator("button.detail-section__trigger").count()) indexes.push(index);
  }

  return indexes;
}

type ResearchOverlayTarget = {
  projectIndex: number;
  triggerIndex: number;
};

async function getResearchOverlayHit(page: Page, panelId: string) {
  return page.evaluate((id) => {
    const panel = document.getElementById(id);
    const project = panel?.closest<HTMLElement>("article.research-project");
    if (!panel || !project) {
      throw new Error("The active Research panel is missing its project.");
    }

    const panelRect = panel.getBoundingClientRect();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "article.research-project, .research-project__resources",
      ),
    ).filter((candidate) => candidate !== project);
    for (const candidate of candidates) {
      const candidateRect = candidate.getBoundingClientRect();
      const left = Math.max(panelRect.left, candidateRect.left, 0);
      const right = Math.min(panelRect.right, candidateRect.right, window.innerWidth);
      const top = Math.max(panelRect.top, candidateRect.top, 0);
      const bottom = Math.min(panelRect.bottom, candidateRect.bottom, window.innerHeight);
      if (right - left < 8 || bottom - top < 8) continue;

      const topElement = document.elementFromPoint(left + 4, top + 4);
      return {
        overlap: true,
        panelOwnsTop: Boolean(topElement && panel.contains(topElement)),
      };
    }

    return { overlap: false, panelOwnsTop: false };
  }, panelId);
}

async function findResearchOverlayTarget(
  page: Page,
  projects: Locator,
  expandableIndexes: readonly number[],
): Promise<ResearchOverlayTarget | undefined> {
  for (const projectIndex of expandableIndexes) {
    const triggers = projects
      .nth(projectIndex)
      .locator("button.detail-section__trigger");

    for (let triggerIndex = (await triggers.count()) - 1; triggerIndex >= 0; triggerIndex -= 1) {
      const trigger = triggers.nth(triggerIndex);
      const panelId = await trigger.getAttribute("aria-controls");
      if (!panelId) continue;

      await trigger.evaluate((element) =>
        element.scrollIntoView({ behavior: "instant", block: "center" }),
      );
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");

      const panel = page.locator(`#${panelId}`);
      await settleDetailPanelMotion(panel);
      const overlayHit = await getResearchOverlayHit(page, panelId);

      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");

      if (overlayHit.overlap) {
        return { projectIndex, triggerIndex };
      }
    }
  }

  return undefined;
}

async function findResearchResourceWithFreeHitTarget(
  page: Page,
): Promise<Locator | undefined> {
  const resources = page.locator(
    'a.research-project__resource[target="_blank"]',
  );

  for (let index = 0; index < (await resources.count()); index += 1) {
    const resource = resources.nth(index);
    await resource.evaluate((element) =>
      element.scrollIntoView({ behavior: "instant", block: "center" }),
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve()),
          ),
        ),
    );
    const canReceivePointer = await resource.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        rect.left < 0 ||
        rect.right > window.innerWidth ||
        rect.top < 0 ||
        rect.bottom > window.innerHeight
      ) {
        return false;
      }

      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return Boolean(hit && element.contains(hit));
    });
    if (canReceivePointer) return resource;
  }

  return undefined;
}

async function expectRenderedCardIdentity(project: Locator, index: number) {
  const projectIndex = project.locator(".research-project__index");
  const organizationLogo = project.locator("img.research-project__organization-logo");
  const pendingResources = project.locator("button.research-project__resource--pending");

  await expect(projectIndex).toHaveText(String(index + 1));

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
  const dialogRoot = page.getByTestId("research-media-dialog");
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
  const figure = dialog.locator(".research-media-dialog__figure");
  const image = dialog.locator(".research-media-dialog__image");
  const closeButton = dialog.locator(".research-media-dialog__close");
  const [figureBox, imageBox, closeBox, overflow] = await Promise.all([
    figure.boundingBox(),
    image.boundingBox(),
    closeButton.boundingBox(),
    dialog.evaluate((frame) => {
      const figureElement = frame.querySelector<HTMLElement>(".research-media-dialog__figure");
      const imageElement = frame.querySelector<HTMLImageElement>(".research-media-dialog__image");

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
  await expect(closeButton).toHaveCSS("position", "absolute");
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
  const minimumGutter = viewport!.width >= 768 ? 32 : 16;
  expect(dialogBox!.x).toBeGreaterThanOrEqual(minimumGutter - 1);
  expect(viewport!.width - (dialogBox!.x + dialogBox!.width)).toBeGreaterThanOrEqual(minimumGutter - 1);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(minimumGutter - 1);
  expect(viewport!.height - (dialogBox!.y + dialogBox!.height)).toBeGreaterThanOrEqual(minimumGutter - 1);
  expect(dialogBox!.height).toBeLessThanOrEqual(viewport!.height * 0.84 + 1);
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
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
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
    await expectResolverOwnedMediaTitles(projects);
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
      await firstDisclosure.focus();
      await page.keyboard.press("Tab");
      await expect(panel.locator(".detail-section__panel-scroll")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(secondDisclosure).toBeFocused();
      await page.keyboard.press("Enter");
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

  test("clips each desktop visual column at the card's outer corners", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const projects = await expectResearchProjectsOrEmptyState(page);
    if (!projects) return;

    const clipping = await projects.evaluateAll((cards) =>
      cards.map((card) => {
        const visual = card.querySelector<HTMLElement>(".research-project__visual");
        if (!visual) throw new Error("Research project is missing its visual column.");

        const cardRect = card.getBoundingClientRect();
        const visualRect = visual.getBoundingClientRect();
        const styles = getComputedStyle(visual);
        return {
          card: { left: cardRect.left, right: cardRect.right },
          corners: {
            bottomLeft: parseFloat(styles.borderBottomLeftRadius),
            bottomRight: parseFloat(styles.borderBottomRightRadius),
            topLeft: parseFloat(styles.borderTopLeftRadius),
            topRight: parseFloat(styles.borderTopRightRadius)
          },
          overflow: styles.overflow,
          side: card.getAttribute("data-visual-side"),
          visual: { left: visualRect.left, right: visualRect.right }
        };
      })
    );

    for (const project of clipping) {
      expect(project.overflow).toBe("hidden");
      if (project.side === "left") {
        expect(Math.abs(project.visual.left - project.card.left)).toBeCloseTo(1, 1);
        expect(project.corners.topLeft).toBeGreaterThan(0);
        expect(project.corners.bottomLeft).toBeGreaterThan(0);
        expect(project.corners.topRight).toBe(0);
        expect(project.corners.bottomRight).toBe(0);
      } else {
        expect(Math.abs(project.visual.right - project.card.right)).toBeCloseTo(1, 1);
        expect(project.corners.topRight).toBeGreaterThan(0);
        expect(project.corners.bottomRight).toBeGreaterThan(0);
        expect(project.corners.topLeft).toBe(0);
        expect(project.corners.bottomLeft).toBe(0);
      }
    }
  });

  test("keeps each rendered media stack abstract-first in two centered desktop rows", async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    for (const theme of ["navy", "light", "dark"] as const) {
      await reloadWithStoredTheme(page, theme);
      await settleLayout(page);
      const projects = await expectResearchProjectsOrEmptyState(page);
      if (!projects) continue;

      const stacks = projects.locator(".research-media-stack");
      for (let index = 0; index < (await stacks.count()); index += 1) {
        const stack = stacks.nth(index);
        const rows = stack.locator(":scope > .research-project__media-row");
        const divider = stack.locator(
          ":scope > .research-project__media-divider",
        );
        await expect(rows).toHaveCount(2);
        await expect(divider).toHaveCount(1);
        await expect(rows.nth(0)).toHaveClass(
          /research-project__media-row--abstract/,
        );
        await expect(rows.nth(1)).toHaveClass(
          /research-project__media-row--explainer/,
        );
        await expect(rows.nth(0).locator(".research-abstract")).toHaveCount(1);
        await expect(
          rows
            .nth(1)
            .locator(":is(.research-video, [data-research-explainer])"),
        ).toHaveCount(1);

        const geometry = await stack.evaluate((stackElement) => {
          const rows = Array.from(
            stackElement.querySelectorAll<HTMLElement>(
              ":scope > .research-project__media-row",
            ),
          );
          const divider = stackElement.querySelector<HTMLElement>(
            ":scope > .research-project__media-divider",
          );
          if (rows.length !== 2 || !divider)
            throw new Error(
              "Research media stack is missing its rows or divider.",
            );

          const stackBox = stackElement.getBoundingClientRect();
          const dividerBox = divider.getBoundingClientRect();
          return {
            backgroundColor: getComputedStyle(stackElement).backgroundColor,
            backgroundImage: getComputedStyle(stackElement).backgroundImage,
            divider: {
              height: dividerBox.height,
              left: dividerBox.left - stackBox.left,
              right: stackBox.right - dividerBox.right,
            },
            rows: rows.map((row) => {
              const box = row.getBoundingClientRect();
              const medium = row.querySelector<HTMLElement>(
                ":scope > .research-abstract, :scope > .research-video, :scope > .research-explainer",
              );
              const mediumBox = medium?.getBoundingClientRect();
              const style = getComputedStyle(row);
              return {
                alignContent: style.alignContent,
                height: box.height,
                mediumLeft: mediumBox ? mediumBox.left - box.left : undefined,
                mediumRight: mediumBox
                  ? box.right - mediumBox.right
                  : undefined,
                mediumWidth: mediumBox?.width,
                paddingLeft: style.paddingLeft,
                paddingRight: style.paddingRight,
                width: box.width,
              };
            }),
          };
        });

        expect(geometry.backgroundColor).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
        expect(geometry.backgroundImage).toBe("none");
        expect(geometry.divider.height).toBeCloseTo(1, 0);
        expect(geometry.divider.left).toBeCloseTo(24, 0);
        expect(geometry.divider.right).toBeCloseTo(24, 0);
        expect(geometry.rows[0]!.height).toBeCloseTo(
          geometry.rows[1]!.height,
          0,
        );
        for (const row of geometry.rows) {
          expect(row.alignContent).toBe("center");
          expect(row.paddingLeft).toBe("16px");
          expect(row.paddingRight).toBe("16px");
          expect(row.mediumWidth).toBeDefined();
          expect(row.mediumWidth!).toBeLessThanOrEqual(512);
          expect(
            Math.abs((row.mediumLeft ?? 0) - (row.mediumRight ?? 0)),
          ).toBeLessThanOrEqual(1);
        }
      }

      await expectNoHorizontalOverflow(page);
    }
  });

  test("keeps complete connected explainer scenes visible through every cinematic phase", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    for (const explainer of await getRenderedResearchExplainers(page)) {
      await explainer.scrollIntoViewIfNeeded();
      const contract = await expectResearchExplainerStaticContent(explainer);
      await expectExplainerSceneVisibleAtEveryPhase(explainer, contract);
    }
  });

  test("runs rendered diagram explainers only while eligible and retains a manual pause", async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const explainers = await getRenderedResearchExplainers(page);
    if (explainers.length === 0) return;

    for (const explainer of explainers) {
      await explainer.scrollIntoViewIfNeeded();
      const contract = await expectResearchExplainerStaticContent(explainer);
      const subjectSelector = contract.phaseSubjects.join(", ");
      const control = explainer.locator(
        "button.research-explainer__playback-control",
      );
      await expect(control).toHaveCount(1);
      await expect(explainer).toHaveAttribute("data-playback", "playing");
      await expect(control).toHaveAccessibleName(/^Pause\b/);

      const controlBox = await control.boundingBox();
      expect(controlBox).not.toBeNull();
      expect(controlBox!.width).toBeGreaterThanOrEqual(44);
      expect(controlBox!.height).toBeGreaterThanOrEqual(44);
      const subjectAnimations = await getExplainerAnimationStyles(
        explainer,
        subjectSelector,
      );
      expect(subjectAnimations.length).toBeGreaterThanOrEqual(4);
      for (const animation of subjectAnimations) {
        expect(animation.animationName).not.toBe("none");
        expect(animation.animationDuration).toBe("12s");
        expect(animation.playState).toBe("running");
      }

      const runningSubjectStart = await sampleExplainerTimeline(explainer, subjectSelector);
      const runningSubjectNextFrame = await sampleExplainerTimeline(explainer, subjectSelector, 2);
      expect(runningSubjectNextFrame.some((time, index) => time > runningSubjectStart[index]!)).toBe(true);

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(explainer).toHaveAttribute("data-playback", "waiting");
      await expect(control).toHaveAccessibleName(/^Pause\b/);
      await expect
        .poll(async () =>
          (await getExplainerAnimationStyles(explainer, subjectSelector)).every(
            (animation) => animation.playState === "paused",
          ),
        )
        .toBe(true);
      await waitForExplainerTimelineToFreeze(explainer, subjectSelector);
      const heldSubjectStart = await sampleExplainerTimeline(explainer, subjectSelector);
      const heldSubjectNextFrame = await sampleExplainerTimeline(explainer, subjectSelector, 2);
      for (const [index, time] of heldSubjectNextFrame.entries()) {
        expect(Math.abs(time - heldSubjectStart[index]!)).toBeLessThanOrEqual(1);
      }

      await explainer.scrollIntoViewIfNeeded();
      await expect(explainer).toHaveAttribute("data-playback", "playing");
      const resumedTimeline = await sampleExplainerTimeline(explainer, subjectSelector, 2);
      expect(
        resumedTimeline.some(
          (time, index) => time > heldSubjectNextFrame[index]!,
        ),
      ).toBe(true);

      await setDocumentVisibilityForTest(page, true);
      await expect(explainer).toHaveAttribute("data-playback", "waiting");
      await expect(control).toHaveAccessibleName(/^Pause\b/);
      await setDocumentVisibilityForTest(page, false);
      await expect(explainer).toHaveAttribute("data-playback", "playing");

      await control.click();
      await expect(explainer).toHaveAttribute("data-playback", "paused");
      await expect(control).toHaveAccessibleName(/^Resume\b/);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(explainer).toHaveAttribute("data-playback", "paused");
      await explainer.scrollIntoViewIfNeeded();
      await expect(explainer).toHaveAttribute("data-playback", "paused");
      await setDocumentVisibilityForTest(page, true);
      await setDocumentVisibilityForTest(page, false);
      await expect(explainer).toHaveAttribute("data-playback", "paused");
      await expect(control).toHaveAccessibleName(/^Resume\b/);

      await control.click();
      await expect(explainer).toHaveAttribute("data-playback", "playing");
      await expect(control).toHaveAccessibleName(/^Pause\b/);
    }
  });

  test("keeps cinematic scene labels readable inside each scene at 320px in every palette", async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/research");
    await settleLayout(page);

    for (const theme of ["navy", "light", "dark"] as const) {
      await reloadWithStoredTheme(page, theme);
      const explainers = await getRenderedResearchExplainers(page);
      for (const explainer of explainers) {
        await explainer.scrollIntoViewIfNeeded();
        const contract = await expectResearchExplainerStaticContent(explainer);
        const labelGeometry = await explainer
          .locator(".research-explainer__scene-label")
          .evaluateAll((labels) =>
            labels.map((label) => {
              const scene = label.closest<HTMLElement>(
                ".research-explainer__scene",
              );
              if (!scene) {
                throw new Error("Research explainer label is outside its scene.");
              }
              const labelBox = label.getBoundingClientRect();
              const sceneBox = scene.getBoundingClientRect();
              const style = getComputedStyle(label);
              return {
                bottom: labelBox.bottom,
                fontSize: Number.parseFloat(style.fontSize),
                height: labelBox.height,
                left: labelBox.left,
                right: labelBox.right,
                sceneBottom: sceneBox.bottom,
                sceneLeft: sceneBox.left,
                sceneRight: sceneBox.right,
                sceneTop: sceneBox.top,
                top: labelBox.top,
                visibility: style.visibility,
                width: labelBox.width,
              };
            }),
          );
        expect(labelGeometry).toHaveLength(contract.labels.length);
        for (const label of labelGeometry) {
          expect(label.visibility).toBe("visible");
          expect(label.fontSize).toBeGreaterThanOrEqual(13);
          expect(label.width).toBeGreaterThan(0);
          expect(label.height).toBeGreaterThan(0);
          expect(label.left).toBeGreaterThanOrEqual(label.sceneLeft - 1);
          expect(label.right).toBeLessThanOrEqual(label.sceneRight + 1);
          expect(label.top).toBeGreaterThanOrEqual(label.sceneTop - 1);
          expect(label.bottom).toBeLessThanOrEqual(label.sceneBottom + 1);
        }
      }
      await expectNoHorizontalOverflow(page);
    }
  });

  test("keeps diagram explainers complete and noninteractive when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/research");
    await settleLayout(page);

    const reducedExplainers = await getRenderedResearchExplainers(page);
    for (const explainer of reducedExplainers) {
      await explainer.scrollIntoViewIfNeeded();
      const contract = await expectResearchExplainerStaticContent(explainer);
      await expect(explainer).toHaveAttribute("data-playback", "complete");
      await expect(
        explainer.locator("button.research-explainer__playback-control"),
      ).toHaveCount(0);
      await expect(
        explainer.locator(".research-explainer__control-slot"),
      ).toBeEmpty();
      expect(
        await getExplainerAnimationStyles(
          explainer,
          contract.phaseSubjects.join(", "),
        ),
      ).toHaveLength(0);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("keeps a long desktop evidence body keyboard-scrollable before Escape restores its summary", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 180 });
    await page.goto("/research");
    await settleLayout(page);

    const projects = await expectResearchProjectsOrEmptyState(page);
    if (!projects) return;
    const trigger = projects.locator("button.detail-section__trigger").first();
    if (!(await trigger.count())) return;

    const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
    const scrollport = panel.locator(".detail-section__panel-scroll");
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(scrollport).toBeFocused();
    await settleDetailPanelMotion(panel);
    await expectDetailPanelScrollportFocusVisible(scrollport);

    const scrollable = await scrollport.evaluate((element) => element.scrollHeight > element.clientHeight);
    expect(scrollable).toBe(true);
    await page.keyboard.press("PageDown");
    await expect.poll(() => scrollport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.setViewportSize({ width: 1100, height: 180 });
    await expect(scrollport).toHaveCSS("max-height", "108px");
    await page.setViewportSize({ width: 980, height: 900 });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toHaveCSS("position", "static");
    await expect(scrollport).toHaveCSS("max-height", "none");
  });

  test("opens each rendered graphical abstract in a fitted dialog and restores the exact trigger", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const abstractTriggers = await getRenderedAbstractTriggers(page);
    if (abstractTriggers.length === 0) return;

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
      await expect(dialog.locator(".research-media-dialog__image")).toHaveCSS("object-fit", "contain");
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
    await page.getByTestId("research-media-dialog").click({ position: { x: 2, y: 2 } });
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("anchors full-width graphical abstracts to their local frame at every framing boundary", async ({ page }) => {
    test.slow();

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 1280, height: 600 },
      { width: 921, height: 900 },
      { width: 920, height: 900 },
      { width: 320, height: 568 },
      { width: 390, height: 568 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/research");
      await settleLayout(page);

      for (const trigger of await getRenderedAbstractTriggers(page)) {
        await expectAbstractFrameGeometry(trigger);
      }

      await expectNoHorizontalOverflow(page);
    }
  });

  test("supports keyboard activation, focus trapping, scroll locking, and rapid reopen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const trigger = (await getRenderedAbstractTriggers(page))[0];
    if (!trigger) return;
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
    await page.getByTestId("research-media-dialog").click({ position: { x: 2, y: 2 } });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    await expect(dialog).toBeVisible();
    await closeButton.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
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

    const abstractTriggers = await getRenderedAbstractTriggers(page);
    const projects = await expectResearchProjectsOrEmptyState(page);

    await expectNoHorizontalOverflow(page);

    if (!projects) {
      await expect(page.locator(".detail-mode-control")).toHaveCount(0);
      return;
    }
    await expectResolverOwnedMediaTitles(projects);

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
      await expectAbstractFrameGeometry(abstractTrigger);
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
      { width: 320, height: 568 },
      { width: 390, height: 568 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/research");
      await settleLayout(page);

      const abstractTriggers = await getRenderedAbstractTriggers(page);
      for (const trigger of abstractTriggers) {
        await expectAbstractFrameGeometry(trigger);
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

    for (const width of [921, 920, 621, 620, 390, 320]) {
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

      const trigger = (await getRenderedAbstractTriggers(page))[0];
      if (!trigger) continue;
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

    const abstractTrigger = (await getRenderedAbstractTriggers(page))[0];
    if (abstractTrigger) {
      await expect(abstractTrigger).toHaveCSS("transition-duration", "0s");
      await abstractTrigger.click();
      const dialogRoot = page.getByTestId("research-media-dialog");
      await expect(dialogRoot).toHaveAttribute("data-reduced-motion", "true");
      await page.keyboard.press("Escape");
      await expect(dialogRoot).toBeHidden();
    }

    const disclosureProject = await getFirstProjectWithDisclosure(projects);
    if (disclosureProject) {
      const disclosure = disclosureProject.locator("button.detail-section__trigger").first();
      await disclosure.click();
      const panelId = await disclosure.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      await expect(page.locator(`#${panelId}`)).toHaveCSS("transition-duration", "0s");
      await disclosure.press("Escape");
      await expectReducedMotionDetailOutline(disclosure);
    }
  });

  test("keeps research evidence overlays out of flow through real keyboard and pointer interactions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const projects = await expectResearchProjectsOrEmptyState(page);
    if (!projects) return;
    await expectDetailModeSwitch(page);

    const expandableIndexes = await getExpandableResearchProjectIndexes(projects);
    test.skip(expandableIndexes.length === 0, "Overlay regression requires an expandable Research project.");

    const overlayTarget = await findResearchOverlayTarget(
      page,
      projects,
      expandableIndexes,
    );
    test.skip(
      overlayTarget === undefined,
      "Overlay regression requires a rendered Research disclosure with a visible overlap target.",
    );
    if (!overlayTarget) return;

    const activeIndex = overlayTarget.projectIndex;
    const activeProject = projects.nth(activeIndex);
    const activeTrigger = activeProject
      .locator("button.detail-section__trigger")
      .nth(overlayTarget.triggerIndex);
    const panel = page.locator(`#${await activeTrigger.getAttribute("aria-controls")}`);
    const root = page.locator("main");
    const selectors = { card: "article.research-project", resource: ".research-project__resources" };

    await activeTrigger.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await settleDetailOverlayMotion(root);
    const collapsedLayout = await getDetailOverlaySample(root, selectors);
    const openingSamples = sampleDetailOverlay(root, selectors);
    const openingScrollportSamples = sampleDetailPanelScrollport(panel);
    await activeTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await expect(panel).toHaveCSS("position", "absolute");
    await expect(panel).toHaveCSS("background-image", "none");
    await expect(panel).toHaveCSS("background-color", /^rgb\(/);
    expectStableDetailOverlay(await openingSamples, collapsedLayout);
    expectDetailPanelScrollportWithoutOverflow(await openingScrollportSamples);

    const activePanelId = await panel.getAttribute("id");
    expect(activePanelId).toBeTruthy();
    if (!activePanelId) return;

    const overlayHit = await getResearchOverlayHit(page, activePanelId);
    expect(overlayHit.overlap).toBe(true);
    expect(overlayHit.panelOwnsTop).toBe(true);

    const selectableText = panel.locator(".detail-section__details li").first();
    await selectableText.evaluate((element) =>
      element.scrollIntoView({ behavior: "instant", block: "center" })
    );
    await page.evaluate(
      () => new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())))
    );
    const textLine = await selectableText.evaluate((element) => {
      const text = Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      if (!text) throw new Error("The active evidence detail has no text node to select.");

      const range = document.createRange();
      range.selectNodeContents(text);
      const rect = range.getClientRects()[0];
      if (!rect) throw new Error("The active evidence detail has no selectable text geometry.");
      const y = rect.top + rect.height / 2;
      const startX = rect.left + Math.min(8, rect.width / 4);
      const endX = rect.right - Math.min(8, rect.width / 4);
      return {
        endX,
        hitEnd: element.contains(document.elementFromPoint(endX, y)),
        hitStart: element.contains(document.elementFromPoint(startX, y)),
        startX,
        visible: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight,
        y
      };
    });
    expect(textLine.visible).toBe(true);
    expect(textLine.hitStart).toBe(true);
    expect(textLine.hitEnd).toBe(true);
    await page.mouse.move(textLine.startX, textLine.y);
    await page.mouse.down();
    await page.mouse.move(
      textLine.endX,
      textLine.y,
      { steps: 12 }
    );
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const selection = document.getSelection();
          return selection?.type === "Range" && Boolean(selection.toString().trim());
        })
      )
      .toBe(true);
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");

    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
    await activeTrigger.press("Enter");
    await panel.locator(".detail-section__panel-content").click();
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");

    await activeTrigger.press("Enter");
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    const resource = await findResearchResourceWithFreeHitTarget(page);
    if (resource) {
      await resource.click();
      await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
      await activeTrigger.press("Enter");
      await page.mouse.move(0, 0);
      await settleDetailOverlayMotion(root);
    }
    const openedPanelMotion = await getDetailPanelMotionSample(panel);
    const closingPanelMotionSamples = sampleDetailPanelMotion(panel);
    const closingSamples = sampleDetailOverlay(root, selectors);
    const closingScrollportSamples = sampleDetailPanelScrollport(panel);
    await activeTrigger.press("Escape");
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(activeTrigger).toBeFocused();
    expectDetailPanelClosingMotion(await closingPanelMotionSamples, openedPanelMotion);
    expectStableDetailOverlay(await closingSamples, collapsedLayout);
    expectDetailPanelScrollportWithoutOverflow(await closingScrollportSamples);

    await activeTrigger.click();
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    await settleDetailPanelMotion(panel);
    const openedPointerClosePanelMotion = await getDetailPanelMotionSample(panel);
    const pointerClosePanelMotionSamples = sampleDetailPanelMotion(panel);
    await activeTrigger.click();
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
    expectDetailPanelClosingMotion(await pointerClosePanelMotionSamples, openedPointerClosePanelMotion);

    await activeTrigger.click();
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    const rapidScrollportSamples = sampleDetailPanelScrollport(panel);
    const rapidPanelMotionSamples = sampleDetailPanelMotion(panel);
    await activeTrigger.press("Escape");
    await activeTrigger.press("Enter");
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    await settleDetailPanelMotion(panel);
    await expect(activeTrigger.locator("..")).toHaveAttribute("data-visual-state", "open");
    expectDetailPanelRapidReopen(await rapidPanelMotionSamples);
    expectDetailPanelScrollportWithoutOverflow(await rapidScrollportSamples);

    await page.mouse.move(0, 0);
    await settleDetailOverlayMotion(root);

    const globalSwitchIndex = expandableIndexes.find((index) => index !== activeIndex);
    if (globalSwitchIndex !== undefined) {
      const switchTrigger = projects.nth(globalSwitchIndex).locator("button.detail-section__trigger").first();
      const switchPanel = page.locator(`#${await switchTrigger.getAttribute("aria-controls")}`);

      const openedSwitchPanelMotion = await getDetailPanelMotionSample(panel);
      const switchingPanelMotionSamples = sampleDetailPanelMotion(panel);
      await switchTrigger.focus();
      const switchingSamples = sampleDetailOverlay(root, selectors);
      const switchingScrollportSamples = Promise.all([
        sampleDetailPanelScrollport(panel),
        sampleDetailPanelScrollport(switchPanel)
      ]);
      await page.keyboard.press("Enter");
      await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(switchTrigger).toHaveAttribute("aria-expanded", "true");
      expectDetailPanelClosingMotion(await switchingPanelMotionSamples, openedSwitchPanelMotion);
      expectStableDetailOverlay(await switchingSamples, collapsedLayout);
      for (const samples of await switchingScrollportSamples) {
        expectDetailPanelScrollportWithoutOverflow(samples);
      }

      const switchTriggerId = await switchTrigger.getAttribute("id");
      expect(switchTriggerId).toBeTruthy();
      if (!switchTriggerId) throw new Error("The switched Research disclosure needs an id.");
      const openedPointerSwitchPanelMotion = await getDetailPanelMotionSample(switchPanel);
      const pointerSwitchPanelMotionSamples = sampleDetailPanelMotion(switchPanel);
      await activeTrigger.evaluate((button, openTriggerId) => {
        document.documentElement.removeAttribute("data-detail-expanded-at-outside-activation");
        button.addEventListener(
          "click",
          () => {
            document.documentElement.dataset.detailExpandedAtOutsideActivation =
              document.getElementById(openTriggerId)?.getAttribute("aria-expanded") ?? "missing";
          },
          { once: true }
        );
      }, switchTriggerId);
      await activeTrigger.click();
      await expect(page.locator("html")).toHaveAttribute("data-detail-expanded-at-outside-activation", "true");
      await expect(switchTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
      expectDetailPanelClosingMotion(await pointerSwitchPanelMotionSamples, openedPointerSwitchPanelMotion);
    }

    await activeProject.locator(".research-project__header").click();
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
    await activeTrigger.press("Enter");
    await page.getByRole("heading", { level: 1, name: "Research" }).click();
    await expect(activeTrigger).toHaveAttribute("aria-expanded", "false");

    await activeTrigger.press("Enter");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.mouse.move(0, 0);
    await settleDetailOverlayMotion(root);
    const resizedLayout = await getDetailOverlaySample(root, selectors);
    const resizedCloseSamples = sampleDetailOverlay(root, selectors);
    await activeTrigger.press("Escape");
    expectStableDetailOverlay(await resizedCloseSamples, resizedLayout);

    for (const theme of ["navy", "light", "dark"] as const) {
      await reloadWithStoredTheme(page, theme);
      const themeTrigger = page
        .locator("article.research-project")
        .nth(activeIndex)
        .locator("button.detail-section__trigger")
        .last();
      const themePanel = page.locator(
        `#${await themeTrigger.getAttribute("aria-controls")}`
      );
      await themeTrigger.scrollIntoViewIfNeeded();
      await themeTrigger.click();
      await expect(themePanel).toHaveCSS("background-image", "none");
      await expect(themePanel).toHaveCSS("background-color", /^rgb\(/);
      await themeTrigger.press("Escape");
    }
  });

  test("changes only the research evidence panel at the 981 and 980 boundaries", async ({ page }) => {
    for (const width of [981, 980]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/research");
      await settleLayout(page);
      await settlePageEntryMotion(page);

      const projects = await expectResearchProjectsOrEmptyState(page);
      if (!projects) continue;

      const expandableIndexes = await getExpandableResearchProjectIndexes(projects);
      const projectCount = await projects.count();
      const activeIndex = expandableIndexes.find((index) => index < projectCount - 1);
      if (activeIndex === undefined) continue;

      const trigger = projects.nth(activeIndex).locator("button.detail-section__trigger").first();
      const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
      const followingProject = projects.nth(activeIndex + 1);
      const root = page.locator("main");
      await trigger.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await settleDetailOverlayMotion(root);
      const followingTop = await followingProject.evaluate((project) => project.getBoundingClientRect().top + window.scrollY);

      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(panel).toHaveCSS("position", width === 981 ? "absolute" : "static");
      await settleDetailPanelMotion(panel);
      const nextFollowingTop = await followingProject.evaluate((project) => project.getBoundingClientRect().top + window.scrollY);

      if (width === 981) {
        expect(Math.abs(nextFollowingTop - followingTop)).toBeLessThanOrEqual(1);
      } else {
        expect(nextFollowingTop).toBeGreaterThan(followingTop + 1);
      }
    }
  });

  test("keeps the final evidence row as one connected project surface", async ({ page }) => {
    test.slow();

    const hasDetail = await expectConnectedDetailSurfaceAcrossPalettes(page, {
      cardSelector: "article.research-project",
      pathname: "/research"
    });
    if (!hasDetail) return;

    await expectConnectedDetailSurfaceResponsiveBoundary(page, {
      cardSelector: "article.research-project",
      pathname: "/research"
    });

    await expectReducedMotionConnectedDetailSurface(page, {
      cardSelector: "article.research-project",
      pathname: "/research"
    });
  });

  test("crossfades first, middle, and final evidence outlines with their separators", async ({ page }) => {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/research");
      await settleLayout(page);
      await settlePageEntryMotion(page);

      await expectDetailOutlineMotion(page, "article.research-project");
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

  test("plays CytoCV with enhanced caption, seek, setting, fullscreen, and paused dialog handoff controls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/research");
    await settleLayout(page);

    const project = page.locator('article.research-project[id="cytocv-miller-lab"]');
    const player = project.getByTestId("research-video-player");
    const video = player.locator("video.research-video-player__media");
    await expect(project).toHaveCount(1);
    await expectCustomPlayerContained(player);
    await expect(video).toHaveAttribute("preload", "metadata");
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video).not.toHaveAttribute("autoplay");
    await expect(video).not.toHaveAttribute("controls");
    await expect(project.getByRole("link", { name: "Read transcript" })).toHaveAttribute(
      "href",
      "/images/research/cytocv-supplementary-video-s1-transcript.txt"
    );
    await expect(project.getByRole("link", { name: "Download MP4" })).toHaveCount(0);
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState >= HTMLMediaElement.HAVE_METADATA))
      .toBe(true);

    const bottomControls = player.getByTestId("research-video-bottom-controls");
    const centerControl = player.locator("button.research-video-player__center-control");
    await expect(player).toHaveAttribute("data-controls-visible", "false");
    await expect(bottomControls).toHaveCSS("opacity", "0");
    await expect(bottomControls).toHaveAttribute("aria-hidden", "true");
    await expect(centerControl).toHaveCSS("opacity", "0");
    await expect(centerControl).toHaveCSS("pointer-events", "none");
    await player.hover();
    await expect(player).toHaveAttribute("data-controls-visible", "true");
    await expect(bottomControls).toHaveCSS("opacity", "1");
    await expect(centerControl).toHaveCSS("opacity", "1");
    await page.waitForTimeout(4_150);
    await expect(player).toHaveAttribute("data-controls-visible", "false");
    await expect(bottomControls).toHaveCSS("opacity", "0");
    await expect(centerControl).toHaveCSS("opacity", "0");
    await player.hover();
    await expect(player).toHaveAttribute("data-controls-visible", "true");
    await expect(bottomControls).toHaveCSS("opacity", "1");
    await expect(centerControl).toHaveCSS("opacity", "1");
    await page.mouse.move(0, 0);
    await expect(player).toHaveAttribute("data-controls-visible", "false");
    await expect(bottomControls).toHaveCSS("opacity", "0");
    await expect(centerControl).toHaveCSS("opacity", "0");
    await centerControl.focus();
    await page.keyboard.press("ArrowRight");
    await expect(player).toHaveAttribute("data-controls-visible", "true");
    await expect(bottomControls).toHaveCSS("opacity", "1");
    await expect(centerControl).toHaveCSS("opacity", "1");

    const soundButton = player.getByRole("button", { name: "Mute video" });
    const volumeRange = player.getByTestId("video-volume-range");
    await soundButton.click();
    await expect(volumeRange).toHaveAttribute("data-open", "true");
    await expect(volumeRange).toHaveCSS("width", "68px");
    const [inlinePlayerBox, inlineSoundBox, inlineVolumeBox] = await Promise.all([
      player.boundingBox(),
      soundButton.boundingBox(),
      volumeRange.boundingBox()
    ]);
    expect(inlinePlayerBox).not.toBeNull();
    expect(inlineSoundBox).not.toBeNull();
    expect(inlineVolumeBox).not.toBeNull();
    expect(inlineVolumeBox!.width).toBeGreaterThanOrEqual(56);
    expect(inlineVolumeBox!.width).toBeLessThanOrEqual(72);
    expect(inlineVolumeBox!.x).toBeGreaterThanOrEqual(inlineSoundBox!.x + inlineSoundBox!.width - 1);
    expect(inlineVolumeBox!.x + inlineVolumeBox!.width).toBeLessThanOrEqual(inlinePlayerBox!.x + inlinePlayerBox!.width + 1);
    await volumeRange.locator('input[aria-label="Volume"]').fill("0.5");
    await page.keyboard.press("Escape");
    await expect(volumeRange).toHaveAttribute("data-open", "false");
    await expect(soundButton).toBeFocused();
    await player.getByRole("button", { name: "Mute video" }).click();
    await expect(player.getByRole("button", { name: "Unmute video" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(volumeRange).toHaveAttribute("data-open", "false");
    await player.getByRole("button", { name: "Play video" }).first().click();
    await expect.poll(() => video.evaluate((element) => !(element as HTMLVideoElement).paused)).toBe(true);
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.2);
    const raisedCaptions = player.getByTestId("research-video-captions");
    const lowerCaptions = player.locator(".research-video-player__captions--lower");
    await expect(raisedCaptions).toBeVisible();
    await player.hover();
    await expect(player).toHaveAttribute("data-controls-visible", "true");
    await expect(raisedCaptions).toHaveCSS("opacity", "1");
    await expect(lowerCaptions).toHaveCSS("opacity", "0");
    const raisedCaptionGeometry = await player.evaluate((playerElement) => {
      const rect = (selector: string) => {
        const element = playerElement.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing ${selector}`);
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, top: box.top };
      };
      return {
        bottom: rect("[data-testid='research-video-bottom-controls']"),
        center: rect(".research-video-player__center-control"),
        raised: rect(".research-video-player__captions--raised")
      };
    });
    expect(
      raisedCaptionGeometry.raised.bottom <= raisedCaptionGeometry.center.top + 1 ||
        raisedCaptionGeometry.raised.top >= raisedCaptionGeometry.center.bottom - 1
    ).toBe(true);
    expect(
      raisedCaptionGeometry.raised.bottom <= raisedCaptionGeometry.bottom.top + 1 ||
        raisedCaptionGeometry.raised.top >= raisedCaptionGeometry.bottom.bottom - 1
    ).toBe(true);
    await player.getByRole("button", { name: "Open video settings" }).focus();
    await expect(player).toHaveAttribute("data-controls-visible", "true");
    await player.getByRole("button", { name: "Pause video" }).first().click();
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    await page.mouse.move(0, 0);
    await expect(player).toHaveAttribute("data-controls-visible", "false");
    await expect(bottomControls).toHaveCSS("opacity", "0");
    await expect(centerControl).toHaveCSS("opacity", "0");
    await expect(lowerCaptions).toHaveCSS("opacity", "1");
    await expect(raisedCaptions).toHaveCSS("opacity", "0");
    const lowerCaptionGeometry = await player.evaluate((playerElement) => {
      const rect = (selector: string) => {
        const element = playerElement.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing ${selector}`);
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, top: box.top };
      };
      return {
        center: rect(".research-video-player__center-control"),
        lower: rect(".research-video-player__captions--lower")
      };
    });
    expect(
      lowerCaptionGeometry.lower.bottom <= lowerCaptionGeometry.center.top + 1 ||
        lowerCaptionGeometry.lower.top >= lowerCaptionGeometry.center.bottom - 1
    ).toBe(true);
    await centerControl.focus();
    await page.keyboard.press("ArrowRight");

    const seek = player.locator('input[aria-label="Seek video"]');
    await seek.focus();
    await seek.fill("5");
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(5, 0);
    await expect(player.getByTestId("research-video-time")).toContainText("0:05");

    await player.hover();
    await player.getByRole("button", { name: "Disable captions" }).click();
    await expect(player.getByTestId("research-video-captions")).toHaveCount(0);
    await expect(player.getByRole("button", { name: "Enable captions" })).toHaveAttribute("aria-pressed", "false");
    await player.getByRole("button", { name: "Enable captions" }).click();
    await expect(player.getByTestId("research-video-captions")).toBeVisible();
    await player.scrollIntoViewIfNeeded();
    await player.hover();
    const expandButton = player.getByRole("button", { name: "Open video settings" });
    const settings = player.getByTestId("video-settings");
    const speedRow = settings.getByRole("button", { name: /Playback speed/ });

    await expandButton.click();
    await expect(settings).toHaveAttribute("data-open", "true");
    await settings.evaluate(async (menu) => {
      await Promise.all(menu.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    });
    await expect(speedRow).toBeVisible();
    const [gearBox, speedRowBox] = await Promise.all([expandButton.boundingBox(), speedRow.boundingBox()]);
    expect(gearBox).not.toBeNull();
    expect(speedRowBox).not.toBeNull();
    await page.mouse.move(gearBox!.x + gearBox!.width / 2, gearBox!.y + gearBox!.height / 2);
    await page.mouse.move(speedRowBox!.x + speedRowBox!.width / 2, speedRowBox!.y + speedRowBox!.height / 2, { steps: 10 });
    await expect(settings).toHaveAttribute("data-open", "true");
    await speedRow.click();
    await expect(settings).toHaveAttribute("data-view", "speeds");
    await page.keyboard.press("Escape");
    await expect(settings).toHaveAttribute("data-view", "root");
    await page.keyboard.press("Escape");
    await expect(settings).toHaveAttribute("data-open", "false");

    await expandButton.focus();
    await page.keyboard.press("Enter");
    await expect(settings).toHaveAttribute("role", "group");
    await expect(settings).toHaveAttribute("aria-label", "Video settings");
    await expect(settings).toHaveCSS("opacity", "1");
    await speedRow.focus();
    await page.keyboard.press("Enter");
    await expect(settings).toHaveAttribute("data-view", "speeds");
    const selectedRate = settings.locator('button[aria-pressed="true"]');
    await expect.poll(() => selectedRate.evaluate((element) => document.activeElement === element)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(settings).toHaveAttribute("data-view", "root");
    await expect(speedRow).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(settings).toHaveAttribute("data-open", "false");
    await expect(expandButton).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(settings).toHaveAttribute("data-open", "true");
    await expect(settings).toHaveAttribute("data-view", "root");

    await player.scrollIntoViewIfNeeded();
    await player.hover();
    await expect(settings).toHaveCSS("opacity", "1");
    const expandFromSettings = settings.getByRole("button", { name: "Open enlarged player" });
    await settings.evaluate((menu) => menu.scrollTo({ top: menu.scrollHeight }));
    await expandFromSettings.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "CytoCV supplementary workflow video" });
    const dialogRoot = page.getByTestId("research-media-dialog");
    const dialogPlayer = dialog.getByTestId("research-video-player");
    const dialogVideo = dialogPlayer.locator("video.research-video-player__media");
    await expect(dialog).toBeVisible();
    await expect(dialogRoot).toHaveAttribute("data-state", "open");
    await dialog.evaluate(async (frame) => {
      await Promise.all(frame.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    });
    await expectCustomPlayerContained(dialogPlayer);
    await expect.poll(() => dialogVideo.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    await expect.poll(() => dialogVideo.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(5, 0);

    const [dialogBox, playerBox, closeBox, dialogBarBox] = await Promise.all([
      dialog.boundingBox(),
      dialogPlayer.boundingBox(),
      dialog.getByRole("button", { name: /Close video for CytoCV/ }).boundingBox(),
      dialogPlayer.getByTestId("research-video-bottom-controls").boundingBox()
    ]);
    expect(dialogBox).not.toBeNull();
    expect(playerBox).not.toBeNull();
    expect(closeBox).not.toBeNull();
    expect(dialogBarBox).not.toBeNull();
    expect(dialogBox!.height).toBeLessThanOrEqual(900 * 0.84 + 1);
    expect(dialogBox!.x).toBeGreaterThanOrEqual(31);
    expect(1280 - (dialogBox!.x + dialogBox!.width)).toBeGreaterThanOrEqual(31);
    expect(playerBox!.x).toBeGreaterThanOrEqual(dialogBox!.x - 1);
    expect(playerBox!.x + playerBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width + 1);
    expect(playerBox!.y).toBeGreaterThanOrEqual(closeBox!.y + closeBox!.height - 1);
    expect(playerBox!.y + playerBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1);
    expect(Math.abs(dialogBarBox!.width - playerBox!.width / 3)).toBeLessThanOrEqual(1);
    expect(dialogBarBox!.x + dialogBarBox!.width / 2).toBeCloseTo(playerBox!.x + playerBox!.width / 2, 0);

    await dialogPlayer.scrollIntoViewIfNeeded();
    await dialogPlayer.hover();
    await dialogPlayer.getByRole("button", { name: "Open video settings" }).click();
    await expect(dialogPlayer.getByTestId("video-settings")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogPlayer.getByTestId("video-settings")).toHaveAttribute("data-open", "false");
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    const fullscreenSupported = await page.evaluate(() => document.fullscreenEnabled);
    if (fullscreenSupported) {
      await dialogPlayer.getByRole("button", { name: "Enter fullscreen" }).click();
      await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute("data-testid"))).toBe(
        "research-video-player"
      );
      await dialogPlayer.hover();
      const fullscreenCaptions = dialogPlayer.getByTestId("research-video-captions");
      await expect(fullscreenCaptions).toBeVisible();
      await expect(fullscreenCaptions).toHaveCSS("opacity", "1");
      const [fullscreenPlayerBox, fullscreenBarBox, fullscreenCaptionBox] = await Promise.all([
        dialogPlayer.boundingBox(),
        dialogPlayer.getByTestId("research-video-bottom-controls").boundingBox(),
        fullscreenCaptions.boundingBox()
      ]);
      expect(fullscreenPlayerBox).not.toBeNull();
      expect(fullscreenBarBox).not.toBeNull();
      expect(fullscreenCaptionBox).not.toBeNull();
      expect(fullscreenBarBox!.width).toBeCloseTo(fullscreenPlayerBox!.width / 3, 0);
      expect(fullscreenBarBox!.x + fullscreenBarBox!.width / 2).toBeCloseTo(
        fullscreenPlayerBox!.x + fullscreenPlayerBox!.width / 2,
        0
      );
      expect(fullscreenBarBox!.y - (fullscreenCaptionBox!.y + fullscreenCaptionBox!.height)).toBeGreaterThanOrEqual(7);
      await page.keyboard.press("Escape");
      await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
      await expect(dialog).toBeVisible();
    }

    await dialog.getByRole("button", { name: /Close video for CytoCV/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(expandButton).toBeFocused();
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(5, 0);
  });

  test("keeps the custom CytoCV controls reachable without horizontal overflow on a narrow touch player", async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { height: 568, width: 320 }
    });

    try {
      const page = await context.newPage();
      await page.goto("/research");
      await settleLayout(page);
      const player = page.locator('article.research-project[id="cytocv-miller-lab"]').getByTestId("research-video-player");
      await expectCustomPlayerContained(player);
      await expect(player).toHaveAttribute("data-controls-visible", "false");
      const centerControl = player.locator("button.research-video-player__center-control");
      const bottomControls = player.getByTestId("research-video-bottom-controls");
      await expect(bottomControls).toHaveCSS("opacity", "0");
      await expect(centerControl).toHaveCSS("opacity", "0");
      await player.locator("video.research-video-player__media").tap({ position: { x: 12, y: 12 } });
      await expect(player).toHaveAttribute("data-controls-visible", "true");
      await expect(bottomControls).toHaveCSS("opacity", "1");
      await expect(centerControl).toHaveCSS("opacity", "1");

      const [playerBox, seekBox, bottomBarBox, centerBox, firstActionBox] = await Promise.all([
        player.boundingBox(),
        player.locator('input[aria-label="Seek video"]').boundingBox(),
        bottomControls.boundingBox(),
        centerControl.boundingBox(),
        player.getByRole("button", { name: "Play video" }).last().boundingBox()
      ]);
      expect(playerBox).not.toBeNull();
      expect(seekBox).not.toBeNull();
      expect(bottomBarBox).not.toBeNull();
      expect(centerBox).not.toBeNull();
      expect(firstActionBox).not.toBeNull();
      expect(playerBox!.height).toBeGreaterThanOrEqual(320);
      expect(centerBox!.x + centerBox!.width / 2).toBeCloseTo(playerBox!.x + playerBox!.width / 2, 0);
      expect(centerBox!.y + centerBox!.height / 2).toBeCloseTo(playerBox!.y + playerBox!.height / 2, 0);
      expect(centerBox!.y + centerBox!.height).toBeLessThanOrEqual(bottomBarBox!.y + 1);
      expect(seekBox!.y + seekBox!.height).toBeLessThanOrEqual(firstActionBox!.y + 1);
      await player.getByRole("button", { name: "Mute video" }).click();
      const volumeRange = player.getByTestId("video-volume-range");
      await expect(volumeRange).toHaveAttribute("data-open", "true");
      await expect(volumeRange).toHaveCSS("width", "68px");
      const soundBox = await volumeRange.boundingBox();
      expect(soundBox).not.toBeNull();
      expect(soundBox!.width).toBeGreaterThanOrEqual(56);
      expect(soundBox!.width).toBeLessThanOrEqual(72);
      expect(soundBox!.x).toBeGreaterThanOrEqual(playerBox!.x - 1);
      expect(soundBox!.x + soundBox!.width).toBeLessThanOrEqual(playerBox!.x + playerBox!.width + 1);
      const [expandedCenterBox, expandedBottomBarBox] = await Promise.all([
        centerControl.boundingBox(),
        bottomControls.boundingBox()
      ]);
      expect(expandedCenterBox).not.toBeNull();
      expect(expandedBottomBarBox).not.toBeNull();
      expect(expandedCenterBox!.y + expandedCenterBox!.height).toBeLessThanOrEqual(expandedBottomBarBox!.y + 1);
      await volumeRange.locator('input[aria-label="Volume"]').fill("0.5");
      await page.keyboard.press("Escape");
      await player.getByRole("button", { name: "Play video" }).first().click();
      const captions = player.getByTestId("research-video-captions");
      await expect(captions).toBeVisible();
      await player.getByRole("button", { name: "Pause video", exact: true }).first().click();
      await player.locator('input[aria-label="Seek video"]').fill("19");
      await expect(captions).toContainText("This red image shows the cell contour");
      const captionOverflow = await captions.evaluate((element) => element.scrollHeight - element.clientHeight);
      expect(captionOverflow).toBeLessThanOrEqual(1);
      const [captionBox, activeCenterBox, activeBottomBarBox, activePlayerBox] = await Promise.all([
        captions.boundingBox(),
        player.locator("button.research-video-player__center-control").boundingBox(),
        player.getByTestId("research-video-bottom-controls").boundingBox(),
        player.boundingBox()
      ]);
      expect(captionBox).not.toBeNull();
      expect(activeCenterBox).not.toBeNull();
      expect(activeBottomBarBox).not.toBeNull();
      expect(activePlayerBox).not.toBeNull();
      // At this narrow width, the long published cue moves to the unobstructed
      // top region; it must remain clear of both the permanent center control
      // and the transport below.
      expect(captionBox!.y).toBeGreaterThanOrEqual(activePlayerBox!.y + 4);
      expect(captionBox!.y + captionBox!.height).toBeLessThanOrEqual(activeCenterBox!.y + 1);
      expect(captionBox!.y + captionBox!.height).toBeLessThanOrEqual(activeBottomBarBox!.y + 1);
      await player.getByRole("button", { name: "Mute video" }).click();
      await expect(volumeRange).toHaveAttribute("data-open", "true");
      const [captionWithVolumeBox, volumeCenterBox, volumePlayerBox] = await Promise.all([
        captions.boundingBox(),
        player.locator("button.research-video-player__center-control").boundingBox(),
        player.boundingBox()
      ]);
      expect(captionWithVolumeBox).not.toBeNull();
      expect(volumeCenterBox).not.toBeNull();
      expect(volumePlayerBox).not.toBeNull();
      expect(captionWithVolumeBox!.y).toBeGreaterThanOrEqual(volumePlayerBox!.y + 4);
      expect(captionWithVolumeBox!.y + captionWithVolumeBox!.height).toBeLessThanOrEqual(volumeCenterBox!.y + 1);
      await page.keyboard.press("Escape");
      await player.locator("video.research-video-player__media").tap({ position: { x: 12, y: 12 } });
      await expect(player).toHaveAttribute("data-controls-visible", "false");
      await expect(bottomControls).toHaveCSS("opacity", "0");
      await expect(centerControl).toHaveCSS("opacity", "0");
      const lowerCaptions = player.locator(".research-video-player__captions--lower");
      const raisedCaptions = player.getByTestId("research-video-captions");
      await expect(lowerCaptions).toHaveCSS("opacity", "1");
      await expect(raisedCaptions).toHaveCSS("opacity", "0");
      const lowerCaptionGeometry = await player.evaluate((playerElement) => {
        const rect = (selector: string) => {
          const element = playerElement.querySelector<HTMLElement>(selector);
          if (!element) throw new Error(`Missing ${selector}`);
          const box = element.getBoundingClientRect();
          return { bottom: box.bottom, top: box.top };
        };
        return {
          center: rect(".research-video-player__center-control"),
          lower: rect(".research-video-player__captions--lower")
        };
      });
      expect(
        lowerCaptionGeometry.lower.bottom <= lowerCaptionGeometry.center.top + 1 ||
          lowerCaptionGeometry.lower.top >= lowerCaptionGeometry.center.bottom - 1
      ).toBe(true);
      await player.locator("video.research-video-player__media").tap({ position: { x: 12, y: 12 } });
      await expect(player).toHaveAttribute("data-controls-visible", "true");
      await expect(bottomControls).toHaveCSS("opacity", "1");
      await expect(centerControl).toHaveCSS("opacity", "1");
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test("wraps the expanded inline volume controls before grouped actions collide at the 321–350px player boundary", async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { height: 568, width: 390 }
    });

    try {
      const page = await context.newPage();
      await page.goto("/research");
      await settleLayout(page);
      const player = page.locator('article.research-project[id="cytocv-miller-lab"]').getByTestId("research-video-player");
      await player.locator("video.research-video-player__media").tap({ position: { x: 12, y: 12 } });
      await player.getByRole("button", { name: "Mute video" }).click();
      const volumeRange = player.getByTestId("video-volume-range");
      await expect(volumeRange).toHaveCSS("width", "68px");
      const geometry = await player.evaluate((playerElement) => {
        const rect = (selector: string) => {
          const element = playerElement.querySelector<HTMLElement>(selector);
          if (!element) throw new Error(`Missing ${selector}`);
          const box = element.getBoundingClientRect();
          return { bottom: box.bottom, left: box.left, right: box.right, top: box.top, width: box.width };
        };

        return {
          actionsLeft: rect(".research-video-player__actions-left"),
          actionsRight: rect(".research-video-player__actions-right"),
          player: (() => {
            const box = playerElement.getBoundingClientRect();
            return { bottom: box.bottom, left: box.left, right: box.right, top: box.top, width: box.width };
          })()
        };
      });

      expect(geometry.player.width).toBeGreaterThanOrEqual(321);
      expect(geometry.player.width).toBeLessThanOrEqual(350);
      expect(geometry.actionsRight.top).toBeGreaterThanOrEqual(geometry.actionsLeft.top + 43);
      expect(geometry.actionsLeft.left).toBeGreaterThanOrEqual(geometry.player.left - 1);
      expect(geometry.actionsRight.right).toBeLessThanOrEqual(geometry.player.right + 1);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test("keeps the CytoCV custom player and enlarged dialog contained in every palette at short desktop and mobile sizes", async ({ page }) => {
    test.slow();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/research");

    for (const viewport of [
      { height: 600, width: 1280 },
      { height: 568, width: 320 }
    ]) {
      for (const theme of ["navy", "light", "dark"] as const) {
        await page.setViewportSize(viewport);
        await reloadWithStoredTheme(page, theme);
        await settleLayout(page);

        const project = page.locator('article.research-project[id="cytocv-miller-lab"]');
        const player = project.getByTestId("research-video-player");
        await player.scrollIntoViewIfNeeded();
        await expectCustomPlayerContained(player);
        await expect(player).toHaveAttribute("data-controls-visible", "false");
        const centerControl = player.locator("button.research-video-player__center-control");
        await expect(centerControl).toHaveCSS("opacity", "0");
        await player.hover();
        const bottomControls = player.getByTestId("research-video-bottom-controls");
        await expect(bottomControls).toHaveCSS("opacity", "1");
        await expect(centerControl).toHaveCSS("opacity", "1");
        await expect(bottomControls).toHaveCSS("transition-duration", "0s");
        await expect(centerControl).toHaveCSS("transition-duration", "0s");
        await expect(player.getByRole("button", { name: "Open video settings" })).toHaveCSS("color", /rgb\(/);
        const glassSurface = await player.evaluate((playerElement) => {
          const bar = playerElement.querySelector<HTMLElement>("[data-testid='research-video-bottom-controls']");
          const control = playerElement.querySelector<HTMLElement>(".research-video-player__control");
          const icon = control?.querySelector<SVGElement>("svg");
          if (!bar || !control || !icon) throw new Error("Missing a Research video glass surface.");

          return {
            barBackdrop: getComputedStyle(bar).backdropFilter,
            barBackground: getComputedStyle(bar).backgroundColor,
            barColor: getComputedStyle(bar).color,
            controlBackground: getComputedStyle(control, "::before").backgroundColor,
            controlColor: getComputedStyle(control).color,
            iconColor: getComputedStyle(icon).color
          };
        });
        expect(glassSurface.barBackdrop).toContain("blur");
        expect(glassSurface.barBackground).toMatch(/rgba\([^)]*,\s*0\.\d+\)|\/\s*0\.\d+\)/);
        expect(glassSurface.controlBackground).toMatch(/rgba\([^)]*,\s*0\.\d+\)|\/\s*0\.\d+\)/);
        expect(glassSurface.barColor).toMatch(/^rgb\(/);
        expect(glassSurface.controlColor).toMatch(/^rgb\(/);
        expect(glassSurface.iconColor).toMatch(/^rgb\(/);
        await player.getByRole("button", { name: "Open video settings" }).click();
        const settings = player.getByTestId("video-settings");
        const expandFromSettings = settings.getByRole("button", { name: "Open enlarged player" });
        await expect(settings).toHaveCSS("opacity", "1");
        await settings.evaluate((menu) => menu.scrollTo({ top: menu.scrollHeight }));
        await expect(expandFromSettings).toBeVisible();
        await expandFromSettings.click();

        const dialog = page.getByRole("dialog", { name: "CytoCV supplementary workflow video" });
        const dialogPlayer = dialog.getByTestId("research-video-player");
        const close = dialog.getByRole("button", { name: /Close video for CytoCV/ });
        await expect(dialog).toBeVisible();
        await dialog.evaluate(async (frame) => {
          await Promise.all(frame.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
        });
        await expectCustomPlayerContained(dialogPlayer);
        const [dialogBox, closeBox, playerBox, dialogBarBox] = await Promise.all([
          dialog.boundingBox(),
          close.boundingBox(),
          dialogPlayer.boundingBox(),
          dialogPlayer.getByTestId("research-video-bottom-controls").boundingBox()
        ]);
        expect(dialogBox).not.toBeNull();
        expect(closeBox).not.toBeNull();
        expect(dialogBarBox).not.toBeNull();
        expect(dialogBox!.height).toBeLessThanOrEqual(viewport.height * 0.84 + 1);
        expect(dialogBox!.x).toBeGreaterThanOrEqual((viewport.width >= 768 ? 32 : 16) - 1);
        expect(viewport.width - (dialogBox!.x + dialogBox!.width)).toBeGreaterThanOrEqual((viewport.width >= 768 ? 32 : 16) - 1);
        expect(closeBox!.width).toBeGreaterThanOrEqual(44);
        expect(closeBox!.height).toBeGreaterThanOrEqual(44);
        expect(playerBox!.y).toBeGreaterThanOrEqual(closeBox!.y + closeBox!.height - 1);
        expect(playerBox!.y + playerBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1);
        expect(dialogBarBox!.x + dialogBarBox!.width / 2).toBeCloseTo(playerBox!.x + playerBox!.width / 2, 0);
        if (playerBox!.width < 360) {
          expect(Math.abs(dialogBarBox!.width - (playerBox!.width - 32))).toBeLessThanOrEqual(3);
        }
        await close.click();
        await expect(dialog).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
      }
    }
  });

});
