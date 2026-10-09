import { expect, test, type Locator, type Page } from "./browserTest";
import { siteRoutes, type SiteRoutePath } from "../../src/lib/routing/siteRoutes";
import { experienceOverrideSkeletonMarkup, experienceOverrideSummary } from "./experienceOverrideSkeletonMarkup";
import { skeletonAlignmentMarkupByRoute } from "./skeletonAlignmentMarkup";
import {
  collectStandaloneDocumentSource,
  createStandaloneDocument,
  waitForStandaloneDocumentAssets
} from "./standaloneSkeletonDocument";

type HeaderPart = "description" | "eyebrow" | "title";

type LineBox = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type HeaderGeometry = {
  height: number;
  outer: { height: number; top: number } | null;
  parts: Readonly<Record<HeaderPart, readonly LineBox[]>>;
  top: number;
};

type Viewport = {
  height: number;
  name: string;
  width: number;
};

type ProjectFootprint = {
  actions: number;
  badge: number;
  controls: number;
  divider: number;
  headerAttribution: number;
  visual: number;
};

type ResearchFootprint = {
  abstracts: number;
  formalTitle: boolean;
  mediaDividers: number;
  mediaRows: number;
  mediaTitles: number;
  mediaStacks: number;
  overviewRows: number;
  resources: number;
  singleMedia: number;
  videoPlayers: number;
};

type ResearchMediaStackGeometry = {
  divider: { height: number; left: number; right: number };
  kind: "stack";
  rows: Array<{
    alignContent: string;
    height: number;
    mediumLeft: number | undefined;
    mediumRight: number | undefined;
    mediumWidth: number | undefined;
    paddingLeft: string;
    paddingRight: string;
    width: number;
  }>;
};

type ResearchSingleMediaGeometry = {
  kind: "single";
  medium: {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
  };
  wrapper: {
    alignContent: string;
    height: number;
    paddingBottom: string;
    paddingLeft: string;
    paddingRight: string;
    paddingTop: string;
    width: number;
  };
};

type ResearchMediaGeometry = ResearchMediaStackGeometry | ResearchSingleMediaGeometry;

const primaryViewports: readonly Viewport[] = [
  { height: 844, name: "compact-phone", width: 320 },
  { height: 844, name: "phone", width: 390 },
  { height: 900, name: "lower-tablet", width: 861 },
  { height: 900, name: "tablet", width: 980 },
  { height: 900, name: "desktop-transition", width: 994 },
  { height: 900, name: "fluid-desktop", width: 1100 },
  { height: 900, name: "wide-desktop", width: 1211 },
  { height: 900, name: "desktop", width: 1280 }
];

const headedRoutes = [
  siteRoutes.experience,
  siteRoutes.research,
  siteRoutes.projects,
  siteRoutes.recommendations,
  siteRoutes.resume,
  siteRoutes.contact,
  siteRoutes.contactTerms,
  siteRoutes.terms,
  siteRoutes.privacy,
  siteRoutes.security
] as const;

const headerParts = ["eyebrow", "title", "description"] as const satisfies readonly HeaderPart[];
const lineBoxTolerance = 5;
const standaloneFixturePath = "/__skeleton-alignment-fixture";
const standaloneFixtureRoute = "**/__skeleton-alignment-fixture";

async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    window.scrollTo(0, 0);
  });
}

async function preparePage(
  page: Page,
  viewport: Viewport,
  pathname: SiteRoutePath,
  reducedMotion: "no-preference" | "reduce" = "no-preference",
  colorScheme: "dark" | "light" = "dark"
) {
  // The deterministic mount replaces React-owned children. Leave that document
  // before resizing or navigating again so a resolved client effect never
  // reconciles against test-only static markup.
  if (page.url() !== "about:blank") await page.goto("about:blank");
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.emulateMedia({ colorScheme, reducedMotion });
  await page.setViewportSize(viewport);
  await page.goto(pathname);
  await expect(page.locator(".site-main > .page-container")).toHaveCount(1);
  await settleLayout(page);
}

async function resolvedHeaderGeometry(page: Page): Promise<HeaderGeometry> {
  const title = page.locator(".page-container h1.page-title");
  await expect(title).toHaveCount(1);

  return title.evaluate((titleElement) => {
    const header = titleElement.closest<HTMLElement>(".section-header__copy");
    if (!header) throw new Error("Resolved route header is missing its copy group.");
    const main = titleElement.closest<HTMLElement>(".site-main");
    if (!main) throw new Error("Resolved route header is missing its main landmark.");
    const mainTop = main.getBoundingClientRect().top;
    const headerRect = header.getBoundingClientRect();
    const readLineBoxes = (selector: string) => {
      const part = header.querySelector<HTMLElement>(selector);
      if (!part) return [];
      const range = document.createRange();
      range.selectNodeContents(part);
      return Array.from(range.getClientRects()).map((rect) => ({
        height: rect.height,
        left: rect.left,
        top: rect.top - mainTop,
        width: rect.width
      }));
    };
    const outer = titleElement.closest<HTMLElement>(".page-intro__surface");
    return {
      height: headerRect.height,
      outer: outer ? { height: outer.getBoundingClientRect().height, top: outer.getBoundingClientRect().top - mainTop } : null,
      parts: {
        description: readLineBoxes(".page-description"),
        eyebrow: readLineBoxes(".eyebrow"),
        title: readLineBoxes(".page-title")
      },
      top: headerRect.top - mainTop
    };
  });
}

// Next 16 can retain a resolved route while a prefetched loading boundary is
// pending. The deterministic harness server-renders the canonical loader in a
// same-origin inert document; route loading delegation is unit-tested.
async function mountStaticSkeletonMarkup(
  sourcePage: Page,
  markup: string,
  viewport: Viewport,
  reducedMotion: "no-preference" | "reduce" = "no-preference",
  colorScheme: "dark" | "light" = "dark"
): Promise<{ fixturePage: Page; skeleton: Locator }> {
  const source = await collectStandaloneDocumentSource(sourcePage);
  const fixturePage = await sourcePage.context().newPage();
  await fixturePage.emulateMedia({ colorScheme, reducedMotion });
  await fixturePage.setViewportSize(viewport);
  await fixturePage.route(standaloneFixtureRoute, (route) =>
    route.fulfill({
      body: createStandaloneDocument(source, markup, {
        mainClassName: "site-main",
        markerAttribute: "data-skeleton-alignment-fixture"
      }),
      contentType: "text/html",
      status: 200
    })
  );
  await fixturePage.goto(standaloneFixturePath, { waitUntil: "load" });
  await expect(fixturePage.locator("nextjs-portal")).toHaveCount(0);
  await expect(fixturePage.locator("script")).toHaveCount(0);
  await expect(fixturePage.locator("[data-skeleton-visual-stylesheet]")).toHaveCount(source.stylesheetHrefs.length);
  await waitForStandaloneDocumentAssets(fixturePage, source);
  await fixturePage.addStyleTag({
    content: ".site-main, .site-main * { animation: none !important; transition: none !important; }"
  });
  await settleLayout(fixturePage);

  const skeleton = fixturePage.locator(
    '[data-skeleton-alignment-fixture] [aria-label="Loading page"][aria-busy="true"]'
  );
  await expect(skeleton).toHaveCount(1);
  return { fixturePage, skeleton };
}

async function mountStaticRouteSkeleton(
  page: Page,
  pathname: SiteRoutePath,
  viewport: Viewport,
  reducedMotion: "no-preference" | "reduce" = "no-preference",
  colorScheme: "dark" | "light" = "dark"
): Promise<{ fixturePage: Page; skeleton: Locator }> {
  return mountStaticSkeletonMarkup(
    page,
    skeletonAlignmentMarkupByRoute[pathname],
    viewport,
    reducedMotion,
    colorScheme
  );
}

async function skeletonHeaderGeometry(skeleton: Locator): Promise<HeaderGeometry> {
  return skeleton.evaluate((element) => {
    const header = element.querySelector<HTMLElement>(".route-header-skeleton .section-header__copy");
    if (!header) throw new Error("Canonical static skeleton markup is missing its header copy group.");
    const main = element.closest<HTMLElement>(".site-main");
    if (!main) throw new Error("Canonical static skeleton markup is missing its main landmark.");
    const mainTop = main.getBoundingClientRect().top;
    const outer = element.querySelector<HTMLElement>(
      ".skeleton-page__header, .experience-skeleton__intro, .research-skeleton__intro"
    );
    const headerRect = header.getBoundingClientRect();
    const readLineBoxes = (selector: string) => {
      const part = header.querySelector<HTMLElement>(selector);
      if (!part) return [];
      const range = document.createRange();
      range.selectNodeContents(part);
      return Array.from(range.getClientRects()).map((rect) => ({
        height: rect.height,
        left: rect.left,
        top: rect.top - mainTop,
        width: rect.width
      }));
    };
    return {
      height: headerRect.height,
      outer: outer ? { height: outer.getBoundingClientRect().height, top: outer.getBoundingClientRect().top - mainTop } : null,
      parts: {
        description: readLineBoxes(".route-header-skeleton__description .route-header-skeleton__ink"),
        eyebrow: readLineBoxes(".route-header-skeleton__eyebrow .route-header-skeleton__ink"),
        title: readLineBoxes(".route-header-skeleton__title .route-header-skeleton__ink")
      },
      top: headerRect.top - mainTop
    };
  });
}

function assertViewportHasNoOverflow(page: Page, name: string) {
  return expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), name).resolves.toBe(true);
}

async function getResearchMediaGeometry(
  card: Locator,
  skeleton: boolean,
): Promise<ResearchMediaGeometry | undefined> {
  return card.evaluate((cardElement, isSkeleton) => {
    const stackSelector = isSkeleton
      ? ".research-skeleton__media-stack"
      : ".research-media-stack";
    const rowSelector = isSkeleton
      ? ".research-skeleton__media-row"
      : ".research-project__media-row";
    const dividerSelector = isSkeleton
      ? ".research-skeleton__media-divider"
      : ".research-project__media-divider";
    const mediumSelector = isSkeleton
      ? ":scope > .research-skeleton__abstract, :scope > .research-skeleton__video"
      : ":scope > .research-abstract, :scope > .research-video";
    const stack = cardElement.querySelector<HTMLElement>(stackSelector);
    if (stack) {
      const rows = Array.from(
        stack.querySelectorAll<HTMLElement>(`:scope > ${rowSelector}`),
      );
      const divider = stack.querySelector<HTMLElement>(
        `:scope > ${dividerSelector}`,
      );
      if (rows.length !== 2 || !divider)
        throw new Error(
          "Research video stack is missing its two rows or divider.",
        );

      const stackBox = stack.getBoundingClientRect();
      const dividerBox = divider.getBoundingClientRect();
      return {
        divider: {
          height: dividerBox.height,
          left: dividerBox.left - stackBox.left,
          right: stackBox.right - dividerBox.right,
        },
        kind: "stack",
        rows: rows.map((row) => {
          const rowBox = row.getBoundingClientRect();
          const medium = row.querySelector<HTMLElement>(mediumSelector);
          const mediumBox = medium?.getBoundingClientRect();
          const style = getComputedStyle(row);
          return {
            alignContent: style.alignContent,
            height: rowBox.height,
            mediumLeft: mediumBox ? mediumBox.left - rowBox.left : undefined,
            mediumRight: mediumBox ? rowBox.right - mediumBox.right : undefined,
            mediumWidth: mediumBox?.width,
            paddingLeft: style.paddingLeft,
            paddingRight: style.paddingRight,
            width: rowBox.width,
          };
        }),
      };
    }

    const singleSelector = isSkeleton
      ? ".research-skeleton__single-media"
      : ".research-project__single-media";
    const singleMediumSelector = isSkeleton
      ? ":scope > .research-skeleton__abstract"
      : ":scope > .research-abstract";
    const single = cardElement.querySelector<HTMLElement>(singleSelector);
    if (!single) return undefined;
    const medium = single.querySelector<HTMLElement>(singleMediumSelector);
    if (!medium) throw new Error("Research single-media wrapper is missing its graphical abstract.");

    const wrapperBox = single.getBoundingClientRect();
    const mediumBox = medium.getBoundingClientRect();
    const style = getComputedStyle(single);
    return {
      kind: "single",
      medium: {
        bottom: wrapperBox.bottom - mediumBox.bottom,
        height: mediumBox.height,
        left: mediumBox.left - wrapperBox.left,
        right: wrapperBox.right - mediumBox.right,
        top: mediumBox.top - wrapperBox.top,
        width: mediumBox.width,
      },
      wrapper: {
        alignContent: style.alignContent,
        height: wrapperBox.height,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        paddingTop: style.paddingTop,
        width: wrapperBox.width,
      },
    };
  }, skeleton);
}

function assertIntrinsicHeaderMatch(held: HeaderGeometry, resolved: HeaderGeometry, pathname: SiteRoutePath, viewport: Viewport) {
  for (const part of headerParts) {
    const heldLines = held.parts[part];
    const resolvedLines = resolved.parts[part];
    expect(
      heldLines,
      `${pathname} ${part} line count at ${viewport.name} (held ${heldLines.map((line) => Math.round(line.width)).join(",")}; resolved ${resolvedLines.map((line) => Math.round(line.width)).join(",")})`
    ).toHaveLength(resolvedLines.length);

    for (const [index, resolvedLine] of resolvedLines.entries()) {
      const heldLine = heldLines[index]!;
      // Text Range values retain fractional font metrics; five pixels keeps
      // this direct comparison strict while allowing raster rounding.
      expect(Math.abs(heldLine.left - resolvedLine.left), `${pathname} ${part} line ${index + 1} left at ${viewport.name}`).toBeLessThanOrEqual(lineBoxTolerance);
      expect(Math.abs(heldLine.top - resolvedLine.top), `${pathname} ${part} line ${index + 1} top at ${viewport.name}`).toBeLessThanOrEqual(lineBoxTolerance);
      expect(Math.abs(heldLine.width - resolvedLine.width), `${pathname} ${part} line ${index + 1} width at ${viewport.name}`).toBeLessThanOrEqual(lineBoxTolerance);
      expect(Math.abs(heldLine.height - resolvedLine.height), `${pathname} ${part} line ${index + 1} height at ${viewport.name}`).toBeLessThanOrEqual(lineBoxTolerance);
    }
  }

  expect(Math.abs(held.top - resolved.top), `${pathname} header copy top at ${viewport.name}`).toBeLessThanOrEqual(lineBoxTolerance);
  expect(Math.abs(held.height - resolved.height), `${pathname} header copy height at ${viewport.name}`).toBeLessThanOrEqual(lineBoxTolerance);
  expect(held.outer, `${pathname} skeleton outer header at ${viewport.name}`).not.toBeNull();
  expect(resolved.outer, `${pathname} resolved outer header at ${viewport.name}`).not.toBeNull();
  expect(Math.abs(held.outer!.top - resolved.outer!.top), `${pathname} outer header top at ${viewport.name}`).toBeLessThanOrEqual(lineBoxTolerance);
  expect(
    Math.abs(held.outer!.height - resolved.outer!.height),
    `${pathname} outer header height at ${viewport.name} (held ${held.outer!.height}, resolved ${resolved.outer!.height})`
  ).toBeLessThanOrEqual(lineBoxTolerance);
}

async function compareRouteAtWidths(page: Page, pathname: SiteRoutePath, viewports: readonly Viewport[]) {
  await preparePage(page, viewports[0]!, pathname);
  // Geometry is measured in a deterministic static harness. The product keeps
  // its resolved body-entry motion; this test disables it only while comparing
  // static loader and resolved line boxes, then exercises reduced motion below.
  await page.addStyleTag({
    content: ".site-main, .site-main * { animation: none !important; transition: none !important; }"
  });
  await settleLayout(page);
  const { fixturePage, skeleton } = await mountStaticRouteSkeleton(page, pathname, viewports[0]!);

  try {
    for (const viewport of viewports) {
      await Promise.all([page.setViewportSize(viewport), fixturePage.setViewportSize(viewport)]);
      await Promise.all([settleLayout(page), settleLayout(fixturePage)]);
      const resolved = await resolvedHeaderGeometry(page);
      const held = await skeletonHeaderGeometry(skeleton);
      assertIntrinsicHeaderMatch(held, resolved, pathname, viewport);
      await assertViewportHasNoOverflow(fixturePage, `${pathname} skeleton does not overflow at ${viewport.name}`);
    }
  } finally {
    await fixturePage.close();
  }
}

test.describe.configure({ mode: "serial" });

test("matches real resolved header Range geometry through compact, tablet, and fluid desktop widths", async ({ page }) => {
  test.setTimeout(180_000);
  for (const pathname of headedRoutes) {
    await compareRouteAtWidths(page, pathname, primaryViewports);
  }
});

test("tracks representative source wrap transitions without route-specific geometry tables", async ({ page }) => {
  test.setTimeout(120_000);
  const transitionViewports = [
    [siteRoutes.experience, 354],
    [siteRoutes.research, 334],
    [siteRoutes.projects, 343],
    [siteRoutes.recommendations, 339],
    [siteRoutes.resume, 336],
    [siteRoutes.contact, 323],
    [siteRoutes.contactTerms, 363],
    [siteRoutes.terms, 334],
    [siteRoutes.privacy, 337],
    [siteRoutes.security, 346],
    [siteRoutes.projects, 878],
    [siteRoutes.recommendations, 893],
    [siteRoutes.research, 934],
    [siteRoutes.contact, 964]
  ] as const;

  for (const [pathname, width] of transitionViewports) {
    await compareRouteAtWidths(page, pathname, [{ height: 900, name: `${pathname}-${width}`, width }]);
  }
});

test("keeps a valid generated Experience summary override geometrically identical to its resolved header", async ({ page }) => {
  for (const viewport of [primaryViewports[1]!, primaryViewports[4]!]) {
    await preparePage(page, viewport, siteRoutes.experience);
    await page.addStyleTag({ content: ".site-main, .site-main * { animation: none !important; transition: none !important; }" });
    await page.locator(".page-container--experience .page-description").evaluate((description, summary) => {
      description.textContent = summary;
    }, experienceOverrideSummary);
    const resolved = await resolvedHeaderGeometry(page);
    const { fixturePage, skeleton } = await mountStaticSkeletonMarkup(
      page,
      experienceOverrideSkeletonMarkup,
      viewport
    );
    try {
      await expect(skeleton.locator(".route-header-skeleton__description .route-header-skeleton__ink")).toHaveText(
        experienceOverrideSummary
      );
      const held = await skeletonHeaderGeometry(skeleton);
      assertIntrinsicHeaderMatch(held, resolved, siteRoutes.experience, viewport);
      await assertViewportHasNoOverflow(fixturePage, `Experience override skeleton does not overflow at ${viewport.name}`);
    } finally {
      await fixturePage.close();
    }
  }
});

test("keeps canonical Home loader within each responsive header matrix width", async ({ page }) => {
  for (const viewport of primaryViewports) {
    // Use an unrelated resolved route only to collect the real stylesheet and
    // font source for Home's inert standalone skeleton document.
    await preparePage(page, viewport, siteRoutes.projects);
    const { fixturePage, skeleton } = await mountStaticRouteSkeleton(page, siteRoutes.home, viewport);
    try {
      await expect(skeleton.locator(".home-skeleton__identity-list > .skeleton-block")).toHaveCount(5);
      await expect(skeleton.locator(".home-skeleton__experience-group")).toHaveCount(4);
      await assertViewportHasNoOverflow(fixturePage, `Home skeleton does not overflow at ${viewport.name}`);
    } finally {
      await fixturePage.close();
    }
  }
});

test("matches the Home hero's 720, 860, and 980 responsive boundaries", async ({ page }) => {
  for (const width of [720, 721, 860, 861, 980, 981]) {
    const viewport = { height: 900, name: `home-boundary-${width}`, width };
    await preparePage(page, viewport, siteRoutes.projects);
    const { fixturePage, skeleton } = await mountStaticRouteSkeleton(page, siteRoutes.home, viewport);
    try {
      const geometry = await skeleton.locator(".home-skeleton__hero").evaluate((hero) => {
        const read = (selector: string) => {
          const element = hero.querySelector<HTMLElement>(selector);
          if (!element) throw new Error(`Missing ${selector}`);
          const rect = element.getBoundingClientRect();
          return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
        };
        const introduction = read(".home-skeleton__introduction");
        const profile = read(".home-skeleton__profile");
        const details = read(".home-skeleton__details");
        const portrait = read(".home-skeleton__portrait-column");
        const identity = read(".home-skeleton__identity-list");
        return {
          detailsAfterProfile: details.top >= profile.bottom - 1,
          identityBesidePortrait: identity.left >= portrait.right - 1 && identity.top <= portrait.bottom,
          introductionBeforeDetails: introduction.bottom <= details.top + 1,
          introductionBeforeProfile: introduction.bottom <= profile.top + 1,
          profileBesideIntroduction: profile.right <= introduction.left + 1
        };
      });

      if (width <= 720) {
        expect(geometry.introductionBeforeProfile).toBe(true);
        expect(geometry.identityBesidePortrait).toBe(true);
      } else if (width <= 980) {
        expect(geometry.introductionBeforeProfile).toBe(true);
        expect(geometry.identityBesidePortrait).toBe(true);
        expect(geometry.detailsAfterProfile).toBe(true);
      } else {
        expect(geometry.profileBesideIntroduction).toBe(true);
        expect(geometry.introductionBeforeDetails).toBe(true);
      }
      await assertViewportHasNoOverflow(fixturePage, `Home skeleton does not overflow at ${width}px`);
    } finally {
      await fixturePage.close();
    }
  }
});

test("matches real Project and Research detail footprints at compact, visual, column-boundary, and desktop widths", async ({ page }) => {
  const projectResponsiveViewports: readonly Viewport[] = [
    primaryViewports[0]!,
    primaryViewports[1]!,
    { height: 900, name: "visual-boundary-720", width: 720 },
    { height: 900, name: "visual-boundary-721", width: 721 },
    primaryViewports[3]!,
    { height: 900, name: "column-boundary-981", width: 981 },
    primaryViewports.at(-1)!
  ];

  for (const viewport of projectResponsiveViewports) {
    await preparePage(page, viewport, siteRoutes.projects);
    const resolvedProjectFootprints = await page.locator(".project-card--showcase").evaluateAll((cards): ProjectFootprint[] =>
      cards.map((card) => ({
        actions: card.querySelectorAll(".project-card__actions > a").length,
        badge: card.querySelectorAll(".project-card__badge").length,
        controls: card.querySelectorAll(".project-visual-switcher__toggle").length,
        divider: card.querySelectorAll(".project-card__footer-divider").length,
        headerAttribution: card.querySelectorAll(
          ".project-card__showcase-header .content-card__summary > .project-card__attribution",
        ).length,
        visual: card.querySelectorAll(".project-visual-switcher, .project-card__image").length
      }))
    );
    const { fixturePage: projectFixturePage, skeleton: projectSkeleton } = await mountStaticRouteSkeleton(
      page,
      siteRoutes.projects,
      viewport
    );
    try {
      const projectCards = projectSkeleton.locator(".detail-card-skeleton--project");
      await expect(projectCards).toHaveCount(resolvedProjectFootprints.length);
      for (const [index, footprint] of resolvedProjectFootprints.entries()) {
        const card = projectCards.nth(index);
        await expect(card.locator(".detail-card-skeleton__project-header > .skeleton-block")).toHaveCount(1 + footprint.badge);
        await expect(card.locator(".detail-card-skeleton__project-controls > .skeleton-block")).toHaveCount(footprint.controls);
        await expect(card.locator(".detail-card-skeleton__project-visual")).toHaveCount(footprint.visual);
        await expect(card.locator(".detail-card-skeleton__actions > .skeleton-block")).toHaveCount(footprint.actions);
        await expect(card.locator(".detail-card-skeleton__project-divider")).toHaveCount(footprint.divider);
        await expect(
          card.locator(
            ".detail-card-skeleton__project-summary > .detail-card-skeleton__project-attribution",
          ),
        ).toHaveCount(footprint.headerAttribution);
        if (footprint.visual > 0 && footprint.controls > 0) {
          const geometry = await card.evaluate((element) => {
            const visual = element.querySelector<HTMLElement>(".detail-card-skeleton__project-visual");
            const controls = element.querySelector<HTMLElement>(".detail-card-skeleton__project-controls");
            const divider = element.querySelector<HTMLElement>(".detail-card-skeleton__project-divider");
            const actions = element.querySelector<HTMLElement>(".detail-card-skeleton__actions");
            if (!visual || !controls || !actions) throw new Error("Project skeleton is missing its visual, control, or actions row.");
            const visualBox = visual.getBoundingClientRect();
            const controlsBox = controls.getBoundingClientRect();
            const dividerBox = divider?.getBoundingClientRect();
            const actionsBox = actions.getBoundingClientRect();
            return {
              actionsAfterControls: actionsBox.top >= controlsBox.bottom - 1,
              actionsAfterDivider: !dividerBox || actionsBox.top >= dividerBox.bottom - 1,
              controlsAfterVisual: controlsBox.top >= visualBox.bottom - 1,
              dividerAfterControls: !dividerBox || dividerBox.top >= controlsBox.bottom - 1,
              ratio: visualBox.width / visualBox.height
            };
          });
          expect(geometry.controlsAfterVisual, `Projects skeleton control should follow visual at ${viewport.name}`).toBe(true);
          expect(geometry.actionsAfterControls, `Projects skeleton actions should follow control at ${viewport.name}`).toBe(true);
          expect(geometry.dividerAfterControls, `Projects skeleton divider should follow control at ${viewport.name}`).toBe(true);
          expect(geometry.actionsAfterDivider, `Projects skeleton actions should follow divider at ${viewport.name}`).toBe(true);
          const expectedRatio = viewport.width <= 720 ? 4 / 3 : 16 / 10;
          expect(Math.abs(geometry.ratio - expectedRatio), `Projects skeleton visual ratio at ${viewport.name}`).toBeLessThan(0.02);
        }
      }
      await assertViewportHasNoOverflow(projectFixturePage, `Projects skeleton does not overflow at ${viewport.name}`);
    } finally {
      await projectFixturePage.close();
    }

    // Project media has its own 720px frame boundary and 980px column
    // boundary. Research has no contract at those extra widths, so retain its
    // established compact/tablet/desktop matrix rather than expanding this
    // shared, expensive fixture test.
    if (![320, 390, 980, 1280].includes(viewport.width)) continue;

    await preparePage(page, viewport, siteRoutes.research);
    const resolvedResearchFootprints = await page
      .locator(".research-project")
      .evaluateAll((cards): ResearchFootprint[] =>
        cards.map((card) => ({
          abstracts: card.querySelectorAll(".research-abstract").length,
          formalTitle: Boolean(
            card.querySelector(".research-project__formal-title"),
          ),
          mediaDividers: card.querySelectorAll(
            ".research-project__media-divider",
          ).length,
          mediaRows: card.querySelectorAll(".research-project__media-row")
            .length,
          mediaTitles: card.querySelectorAll(".research-media-title").length,
          mediaStacks: card.querySelectorAll(".research-media-stack").length,
          overviewRows: card.querySelectorAll(".detail-list > .detail-section")
            .length,
          resources: card.querySelectorAll(".research-project__resource")
            .length,
          singleMedia: card.querySelectorAll(".research-project__single-media")
            .length,
          videoPlayers: card.querySelectorAll(
            '[data-testid="research-video-player"]',
          ).length,
        })),
      );
    const { fixturePage: researchFixturePage, skeleton: researchSkeleton } = await mountStaticRouteSkeleton(
      page,
      siteRoutes.research,
      viewport
    );
    try {
      const researchCards = researchSkeleton.locator(".research-skeleton__project");
      await expect(researchCards).toHaveCount(resolvedResearchFootprints.length);
      for (const [index, footprint] of resolvedResearchFootprints.entries()) {
        const card = researchCards.nth(index);
        await expect(
          card.locator(":scope .research-skeleton__header > .skeleton-block"),
        ).toHaveCount(footprint.formalTitle ? 2 : 1);
        await expect(
          card.locator(".research-skeleton__details > .skeleton-block"),
        ).toHaveCount(footprint.overviewRows);
        await expect(
          card.locator(".research-skeleton__resources > .skeleton-block"),
        ).toHaveCount(footprint.resources);
        await expect(
          card.locator(".research-skeleton__media-stack"),
        ).toHaveCount(footprint.mediaStacks);
        await expect(card.locator(".research-skeleton__media-row")).toHaveCount(
          footprint.mediaRows,
        );
        await expect(
          card.locator(".research-skeleton__media-divider"),
        ).toHaveCount(footprint.mediaDividers);
        await expect(
          card.locator(".research-skeleton__abstract-frame"),
        ).toHaveCount(footprint.abstracts);
        await expect(
          card.locator(".research-skeleton__single-media"),
        ).toHaveCount(footprint.singleMedia);
        await expect(
          card.locator(".research-skeleton__video-viewport"),
        ).toHaveCount(footprint.videoPlayers);
        await expect(
          card.locator(".research-skeleton__media-title"),
        ).toHaveCount(footprint.mediaTitles);
        const [resolvedMedia, skeletonMedia] = await Promise.all([
          getResearchMediaGeometry(
            page.locator(".research-project").nth(index),
            false,
          ),
          getResearchMediaGeometry(card, true),
        ]);
        expect(skeletonMedia === undefined).toBe(resolvedMedia === undefined);
        if (resolvedMedia && skeletonMedia) {
          expect(skeletonMedia.kind).toBe(resolvedMedia.kind);
          if (resolvedMedia.kind === "single" && skeletonMedia.kind === "single") {
            for (const media of [resolvedMedia, skeletonMedia]) {
              expect(media.wrapper.paddingTop).toBe("16px");
              expect(media.wrapper.paddingRight).toBe("16px");
              expect(media.wrapper.paddingBottom).toBe("16px");
              expect(media.wrapper.paddingLeft).toBe("16px");
              expect(Math.abs(media.medium.left - media.medium.right)).toBeLessThanOrEqual(1);
              expect(media.medium.width).toBeLessThanOrEqual(512);
              if (viewport.width > 920) {
                expect(media.wrapper.alignContent).toBe("center");
                expect(Math.abs(media.medium.top - media.medium.bottom)).toBeLessThanOrEqual(1);
              } else {
                expect(media.wrapper.alignContent).toBe("start");
                expect(media.medium.top).toBeCloseTo(16, 0);
                expect(media.medium.bottom).toBeCloseTo(16, 0);
                expect(media.wrapper.height).toBeCloseTo(media.medium.height + 32, 0);
              }
            }
            expect(Math.abs(resolvedMedia.wrapper.width - skeletonMedia.wrapper.width)).toBeLessThanOrEqual(lineBoxTolerance);
            expect(Math.abs(resolvedMedia.medium.width - skeletonMedia.medium.width)).toBeLessThanOrEqual(lineBoxTolerance);
            continue;
          }
          if (resolvedMedia.kind !== "stack" || skeletonMedia.kind !== "stack") {
            throw new Error("Resolved and skeleton Research media shapes do not match.");
          }
          const expectedDividerInset = viewport.width > 920 ? 24 : 16;
          expect(resolvedMedia.divider.height).toBeCloseTo(1, 0);
          expect(skeletonMedia.divider.height).toBeCloseTo(1, 0);
          expect(resolvedMedia.divider.left).toBeCloseTo(
            expectedDividerInset,
            0,
          );
          expect(resolvedMedia.divider.right).toBeCloseTo(
            expectedDividerInset,
            0,
          );
          expect(skeletonMedia.divider.left).toBeCloseTo(
            expectedDividerInset,
            0,
          );
          expect(skeletonMedia.divider.right).toBeCloseTo(
            expectedDividerInset,
            0,
          );
          for (const [rowIndex, resolvedRow] of resolvedMedia.rows.entries()) {
            const skeletonRow = skeletonMedia.rows[rowIndex]!;
            expect(resolvedRow.alignContent).toBe("center");
            expect(skeletonRow.alignContent).toBe("center");
            expect(resolvedRow.paddingLeft).toBe("16px");
            expect(resolvedRow.paddingRight).toBe("16px");
            expect(skeletonRow.paddingLeft).toBe("16px");
            expect(skeletonRow.paddingRight).toBe("16px");
            expect(
              Math.abs(
                (resolvedRow.mediumLeft ?? 0) - (resolvedRow.mediumRight ?? 0),
              ),
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(
                (skeletonRow.mediumLeft ?? 0) - (skeletonRow.mediumRight ?? 0),
              ),
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(resolvedRow.width - skeletonRow.width),
            ).toBeLessThanOrEqual(lineBoxTolerance);
            expect(
              Math.abs(
                (resolvedRow.mediumWidth ?? 0) - (skeletonRow.mediumWidth ?? 0),
              ),
            ).toBeLessThanOrEqual(lineBoxTolerance);
          }
          if (viewport.width > 920) {
            expect(
              Math.abs(
                resolvedMedia.rows[0]!.height - resolvedMedia.rows[1]!.height,
              ),
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(
                skeletonMedia.rows[0]!.height - skeletonMedia.rows[1]!.height,
              ),
            ).toBeLessThanOrEqual(1);
          }
        }
      }
      await assertViewportHasNoOverflow(researchFixturePage, `Research skeleton does not overflow at ${viewport.name}`);
    } finally {
      await researchFixturePage.close();
    }
  }
});

test("uses static opaque canonical ink in both themes and reduced motion", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const viewport of [primaryViewports[0]!, primaryViewports[1]!, primaryViewports[3]!, primaryViewports[4]!, primaryViewports.at(-1)!]) {
      await preparePage(page, viewport, siteRoutes.research, "reduce", colorScheme);
      const { fixturePage, skeleton } = await mountStaticRouteSkeleton(
        page,
        siteRoutes.research,
        viewport,
        "reduce",
        colorScheme
      );
      try {
        const subtreeMotion = await skeleton.evaluate((root) =>
          [root, ...root.querySelectorAll<HTMLElement>("*")].map((element) => {
            const style = getComputedStyle(element);
            return {
              animationDuration: style.animationDuration,
              animationName: style.animationName,
              backdropFilter: style.backdropFilter,
              backgroundColor: style.backgroundColor,
              backgroundImage: style.backgroundImage,
              filter: style.filter,
              transitionDuration: style.transitionDuration
            };
          })
        );
        expect(subtreeMotion.length).toBeGreaterThan(0);
        for (const style of subtreeMotion) {
          expect(style.animationName).toBe("none");
          expect(style.animationDuration).toBe("0s");
          expect(style.transitionDuration).toBe("0s");
        }
        const inkStyles = await skeleton.locator(".route-header-skeleton__ink").evaluateAll((inks) =>
          inks.map((ink) => {
            const style = getComputedStyle(ink);
            return { backdropFilter: style.backdropFilter, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, filter: style.filter };
          })
        );
        expect(inkStyles.length).toBeGreaterThan(0);
        for (const style of inkStyles) {
          expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
          expect(style.backgroundImage).toBe("none");
          expect(style.backdropFilter).toBe("none");
          expect(style.filter).toBe("none");
        }
        await assertViewportHasNoOverflow(fixturePage, `${colorScheme} reduced skeleton does not overflow at ${viewport.name}`);
      } finally {
        await fixturePage.close();
      }
    }
  }
});
