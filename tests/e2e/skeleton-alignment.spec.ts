import { expect, test, type Locator, type Page } from "@playwright/test";
import { siteRoutes, type SiteRoutePath } from "../../src/components/navigation/siteRoutes";
import { experienceOverrideSkeletonMarkup, experienceOverrideSummary } from "./experienceOverrideSkeletonMarkup";
import { skeletonAlignmentMarkupByRoute } from "./skeletonAlignmentMarkup";

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
  chips: number;
  deepDive: number;
};

type ResearchFootprint = {
  abstracts: number;
  formalTitle: boolean;
  mediaStacks: number;
  overviewRows: number;
  resources: number;
  videoActions: number;
};

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
  siteRoutes.terms,
  siteRoutes.privacy,
  siteRoutes.security
] as const;

const headerParts = ["eyebrow", "title", "description"] as const satisfies readonly HeaderPart[];

async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
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
    const headerRect = header.getBoundingClientRect();
    const readLineBoxes = (selector: string) => {
      const part = header.querySelector<HTMLElement>(selector);
      if (!part) return [];
      const range = document.createRange();
      range.selectNodeContents(part);
      return Array.from(range.getClientRects()).map((rect) => ({ height: rect.height, left: rect.left, top: rect.top, width: rect.width }));
    };
    const outer = titleElement.closest<HTMLElement>(".page-intro__surface");
    return {
      height: headerRect.height,
      outer: outer ? { height: outer.getBoundingClientRect().height, top: outer.getBoundingClientRect().top } : null,
      parts: {
        description: readLineBoxes(".page-description"),
        eyebrow: readLineBoxes(".eyebrow"),
        title: readLineBoxes(".page-title")
      },
      top: headerRect.top
    };
  });
}

// Next 16 can retain a resolved route while a prefetched loading boundary is
// pending. The deterministic harness server-renders the canonical loader and
// mounts it in the real shell instead; route loading delegation is unit-tested.
async function mountStaticSkeletonMarkup(page: Page, markup: string): Promise<Locator> {
  await page.evaluate((markup) => {
    const main = document.querySelector(".site-main");
    if (!main) throw new Error("The site shell is missing its main landmark.");
    const template = document.createElement("template");
    template.innerHTML = markup;
    main.replaceChildren(template.content.cloneNode(true));
  }, markup);

  const skeleton = page.locator('[aria-label="Loading page"][aria-busy="true"]');
  await expect(skeleton).toHaveCount(1);
  await expect(page.locator(".blob-header")).toHaveCount(1);
  await expect(page.locator(".blob-footer")).toHaveCount(1);
  await settleLayout(page);
  return skeleton;
}

async function mountStaticRouteSkeleton(page: Page, pathname: SiteRoutePath): Promise<Locator> {
  return mountStaticSkeletonMarkup(page, skeletonAlignmentMarkupByRoute[pathname]);
}

async function restoreResolvedShell(page: Page, markup: string): Promise<void> {
  await page.locator(".site-main").evaluate((main, resolvedMarkup) => {
    main.innerHTML = resolvedMarkup;
  }, markup);
  await settleLayout(page);
}

async function skeletonHeaderGeometry(skeleton: Locator): Promise<HeaderGeometry> {
  return skeleton.evaluate((element) => {
    const header = element.querySelector<HTMLElement>(".route-header-skeleton .section-header__copy");
    if (!header) throw new Error("Canonical static skeleton markup is missing its header copy group.");
    const outer = element.querySelector<HTMLElement>(
      ".skeleton-page__header, .experience-skeleton__intro, .research-skeleton__intro"
    );
    const headerRect = header.getBoundingClientRect();
    const readLineBoxes = (selector: string) => {
      const part = header.querySelector<HTMLElement>(selector);
      if (!part) return [];
      const range = document.createRange();
      range.selectNodeContents(part);
      return Array.from(range.getClientRects()).map((rect) => ({ height: rect.height, left: rect.left, top: rect.top, width: rect.width }));
    };
    return {
      height: headerRect.height,
      outer: outer ? { height: outer.getBoundingClientRect().height, top: outer.getBoundingClientRect().top } : null,
      parts: {
        description: readLineBoxes(".route-header-skeleton__description .route-header-skeleton__ink"),
        eyebrow: readLineBoxes(".route-header-skeleton__eyebrow .route-header-skeleton__ink"),
        title: readLineBoxes(".route-header-skeleton__title .route-header-skeleton__ink")
      },
      top: headerRect.top
    };
  });
}

function assertViewportHasNoOverflow(page: Page, name: string) {
  return expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), name).resolves.toBe(true);
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
      expect(Math.abs(heldLine.left - resolvedLine.left), `${pathname} ${part} line ${index + 1} left at ${viewport.name}`).toBeLessThanOrEqual(5);
      expect(Math.abs(heldLine.top - resolvedLine.top), `${pathname} ${part} line ${index + 1} top at ${viewport.name}`).toBeLessThanOrEqual(5);
      expect(Math.abs(heldLine.width - resolvedLine.width), `${pathname} ${part} line ${index + 1} width at ${viewport.name}`).toBeLessThanOrEqual(5);
      expect(Math.abs(heldLine.height - resolvedLine.height), `${pathname} ${part} line ${index + 1} height at ${viewport.name}`).toBeLessThanOrEqual(5);
    }
  }

  expect(Math.abs(held.top - resolved.top), `${pathname} header copy top at ${viewport.name}`).toBeLessThanOrEqual(5);
  expect(Math.abs(held.height - resolved.height), `${pathname} header copy height at ${viewport.name}`).toBeLessThanOrEqual(5);
  expect(held.outer, `${pathname} skeleton outer header at ${viewport.name}`).not.toBeNull();
  expect(resolved.outer, `${pathname} resolved outer header at ${viewport.name}`).not.toBeNull();
  expect(Math.abs(held.outer!.top - resolved.outer!.top), `${pathname} outer header top at ${viewport.name}`).toBeLessThanOrEqual(5);
  expect(
    Math.abs(held.outer!.height - resolved.outer!.height),
    `${pathname} outer header height at ${viewport.name} (held ${held.outer!.height}, resolved ${resolved.outer!.height})`
  ).toBeLessThanOrEqual(5);
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
  const resolvedMarkup = await page.locator(".site-main").innerHTML();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await settleLayout(page);
    const resolved = await resolvedHeaderGeometry(page);
    const skeleton = await mountStaticRouteSkeleton(page, pathname);
    const held = await skeletonHeaderGeometry(skeleton);
    assertIntrinsicHeaderMatch(held, resolved, pathname, viewport);
    await assertViewportHasNoOverflow(page, `${pathname} skeleton does not overflow at ${viewport.name}`);
    await restoreResolvedShell(page, resolvedMarkup);
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
    const skeleton = await mountStaticSkeletonMarkup(page, experienceOverrideSkeletonMarkup);
    await expect(skeleton.locator(".route-header-skeleton__description .route-header-skeleton__ink")).toHaveText(
      experienceOverrideSummary
    );
    const held = await skeletonHeaderGeometry(skeleton);
    assertIntrinsicHeaderMatch(held, resolved, siteRoutes.experience, viewport);
    await assertViewportHasNoOverflow(page, `Experience override skeleton does not overflow at ${viewport.name}`);
  }
});

test("keeps canonical Home loader within each responsive header matrix width", async ({ page }) => {
  for (const viewport of primaryViewports) {
    const homePage = await page.context().newPage();
    // Home has client-only measurement effects. Use an unrelated resolved shell
    // before mounting its server-rendered loader so the deterministic harness
    // never asks a hydrated Home tree to reconcile against replacement markup.
    await preparePage(homePage, viewport, siteRoutes.projects);
    const skeleton = await mountStaticRouteSkeleton(homePage, siteRoutes.home);
    await expect(skeleton.locator(".home-skeleton__identity-list > .skeleton-block")).toHaveCount(5);
    await expect(skeleton.locator(".home-skeleton__experience-group")).toHaveCount(3);
    await assertViewportHasNoOverflow(homePage, `Home skeleton does not overflow at ${viewport.name}`);
  }
});

test("matches real Project and Research detail footprints at compact, phone, tablet, and desktop widths", async ({ page }) => {
  for (const viewport of [primaryViewports[0]!, primaryViewports[1]!, primaryViewports[3]!, primaryViewports.at(-1)!]) {
    await preparePage(page, viewport, siteRoutes.projects);
    const resolvedProjectFootprints = await page.locator(".project-card").evaluateAll((cards): ProjectFootprint[] =>
      cards.map((card) => ({
        actions: card.querySelectorAll(".card-links > a").length,
        chips: card.querySelectorAll(".tag-list > *").length,
        deepDive: card.querySelectorAll(".project-card__deep-dive > p").length
      }))
    );
    const projectSkeleton = await mountStaticRouteSkeleton(page, siteRoutes.projects);
    const projectCards = projectSkeleton.locator(".detail-card-skeleton--project");
    await expect(projectCards).toHaveCount(resolvedProjectFootprints.length);
    for (const [index, footprint] of resolvedProjectFootprints.entries()) {
      const card = projectCards.nth(index);
      await expect(card.locator(".detail-card-skeleton__chips > .skeleton-block")).toHaveCount(footprint.chips);
      await expect(card.locator(".detail-card-skeleton__deep-dive-group")).toHaveCount(footprint.deepDive);
      await expect(card.locator(".detail-card-skeleton__actions > .skeleton-block")).toHaveCount(footprint.actions);
    }
    await assertViewportHasNoOverflow(page, `Projects skeleton does not overflow at ${viewport.name}`);

    await preparePage(page, viewport, siteRoutes.research);
    const resolvedResearchFootprints = await page.locator(".research-project").evaluateAll((cards): ResearchFootprint[] =>
      cards.map((card) => ({
        abstracts: card.querySelectorAll(".research-abstract").length,
        formalTitle: Boolean(card.querySelector(".research-project__formal-title")),
        mediaStacks: card.querySelectorAll(".research-media-stack").length,
        overviewRows: card.querySelectorAll(".detail-list > .detail-section").length,
        resources: card.querySelectorAll(".research-project__resource").length,
        videoActions: card.querySelectorAll(".research-video__actions > a, .research-video__actions > button").length
      }))
    );
    const researchSkeleton = await mountStaticRouteSkeleton(page, siteRoutes.research);
    const researchCards = researchSkeleton.locator(".research-skeleton__project");
    await expect(researchCards).toHaveCount(resolvedResearchFootprints.length);
    for (const [index, footprint] of resolvedResearchFootprints.entries()) {
      const card = researchCards.nth(index);
      await expect(card.locator(":scope .research-skeleton__header > .skeleton-block")).toHaveCount(footprint.formalTitle ? 2 : 1);
      await expect(card.locator(".research-skeleton__details > .skeleton-block")).toHaveCount(footprint.overviewRows);
      await expect(card.locator(".research-skeleton__resources > .skeleton-block")).toHaveCount(footprint.resources);
      await expect(card.locator(".research-skeleton__media-stack")).toHaveCount(footprint.mediaStacks);
      await expect(card.locator(".research-skeleton__abstract-frame")).toHaveCount(footprint.abstracts);
      await expect(card.locator(".research-skeleton__video-actions > .skeleton-block")).toHaveCount(footprint.videoActions);
    }
    await assertViewportHasNoOverflow(page, `Research skeleton does not overflow at ${viewport.name}`);
  }
});

test("uses static opaque canonical ink in both themes and reduced motion", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const viewport of [primaryViewports[0]!, primaryViewports[1]!, primaryViewports[3]!, primaryViewports[4]!, primaryViewports.at(-1)!]) {
      await preparePage(page, viewport, siteRoutes.research, "reduce", colorScheme);
      const skeleton = await mountStaticRouteSkeleton(page, siteRoutes.research);
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
      await assertViewportHasNoOverflow(page, `${colorScheme} reduced skeleton does not overflow at ${viewport.name}`);
    }
  }
});
