import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function collectFiles(directory: string, extensions: string[]): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(entryPath, extensions);
    }

    return extensions.includes(path.extname(entry.name)) ? [entryPath] : [];
  });
}

describe("static portfolio security contracts", () => {
  it("does not define API routes, route handlers, or server actions", () => {
    const appFiles = collectFiles(path.join(projectRoot, "src", "app"), [".ts", ".tsx"]);
    const routeHandlers = appFiles.filter((filePath) => path.basename(filePath).startsWith("route."));
    const serverActionFiles = appFiles.filter((filePath) => readFileSync(filePath, "utf8").includes("\"use server\""));

    expect(routeHandlers).toEqual([]);
    expect(serverActionFiles).toEqual([]);
  });

  it("does not fetch portfolio content at runtime from source files", () => {
    const sourceFiles = collectFiles(path.join(projectRoot, "src"), [".ts", ".tsx"]).filter((filePath) => !filePath.endsWith(".test.ts"));
    const runtimeFetchFiles = sourceFiles.filter((filePath) => readFileSync(filePath, "utf8").includes("fetch("));

    expect(runtimeFetchFiles).toEqual([]);
  });

  it("renders structured recommendation quote links without parsing spreadsheet markup", () => {
    const recommendationTextSource = readFileSync(
      path.join(projectRoot, "src", "components", "portfolio", "ExpandableRecommendationText.tsx"),
      "utf8"
    );

    expect(recommendationTextSource).toMatch(/<SmartLink[^>]*href=\{link\.url\}/s);
    expect(recommendationTextSource).toMatch(/\{link\.label\}/);
    expect(recommendationTextSource).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=/);
    expect(recommendationTextSource).not.toContain("github.com/BrentLagesse/CytoCV");
  });

  it("keeps scroll motion free of text blur", () => {
    const motionCss = readFileSync(path.join(projectRoot, "src", "styles", "motion.css"), "utf8");

    expect(motionCss).not.toMatch(/filter:\s*blur/);
    expect(motionCss).not.toMatch(/transition:[^;]*filter/s);
  });

  it("keeps compact header motion readable and reduced-motion aware", () => {
    const navigationCss = readFileSync(path.join(projectRoot, "src", "styles", "navigation.css"), "utf8");
    const tokensCss = readFileSync(path.join(projectRoot, "src", "styles", "tokens.css"), "utf8");
    const glassCss = readFileSync(path.join(projectRoot, "src", "styles", "glass.css"), "utf8");

    expect(navigationCss).toMatch(/\.blob-header--compact/);
    expect(tokensCss).toMatch(/--header-full-width:\s*var\(--container-width\)/);
    expect(tokensCss).toMatch(/--header-compact-width:\s*1040px/);
    expect(tokensCss).toMatch(/--header-motion-duration:\s*460ms/);
    expect(tokensCss).toMatch(/--header-motion-easing:\s*cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/);
    expect(tokensCss).toMatch(/--transition-header:\s*var\(--header-motion-duration\)\s+var\(--header-motion-easing\)/);
    expect(tokensCss).toMatch(/--header-nav-link-height:\s*34px/);
    expect(tokensCss).toMatch(/--header-nav-link-padding-inline:\s*14px/);
    expect(tokensCss).toMatch(/--header-nav-link-compact-height:\s*32px/);
    expect(tokensCss).toMatch(/--header-nav-link-compact-padding-inline:\s*10px/);
    expect(navigationCss).toMatch(/width:\s*min\(var\(--header-full-width\),\s*calc\(100%\s*-\s*32px\)\)/);
    expect(navigationCss).toMatch(/width:\s*min\(var\(--header-compact-width\),\s*calc\(100%\s*-\s*32px\)\)/);
    expect(navigationCss).not.toMatch(/\.blob-header--compact\s*{[^}]*opacity:\s*0\.92/s);
    expect(navigationCss).toMatch(/var\(--transition-header\)/);
    expect(navigationCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(navigationCss).toMatch(/transition:\s*none/);
    expect(navigationCss).not.toMatch(/\.blob-header--compact\s+\.main-navigation__link\s+span\s*{[^}]*display:\s*none/s);
    expect(navigationCss).toMatch(/\.site-brand__text\s*{[^}]*cursor:\s*default[^}]*user-select:\s*none/s);
    expect(navigationCss).toMatch(/\.blob-header__island\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/s);
    expect(navigationCss).toMatch(/\.blob-header--compact\s+\.blob-header__island\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/s);
    expect(navigationCss).toMatch(/\.main-navigation__link\s*{[^}]*min-height:\s*var\(--header-nav-link-height\)[^}]*padding:\s*0\s+var\(--header-nav-link-padding-inline\)/s);
    expect(navigationCss).toMatch(/\.blob-header--compact\s+\.main-navigation__link\s*{[^}]*min-height:\s*var\(--header-nav-link-compact-height\)[^}]*padding:\s*0\s+var\(--header-nav-link-compact-padding-inline\)/s);
    expect(tokensCss).toMatch(/--color-header-surface:\s*rgba\(5,\s*16,\s*31,\s*0\.9\)/);
    expect(glassCss).toMatch(/\.glass-blob--nav\s*{[^}]*background:\s*var\(--color-header-surface\)/s);
    expect(glassCss).toMatch(/\.glass-blob--nav\s*{[^}]*overflow:\s*visible/s);
    expect(glassCss).toMatch(/\.glass-blob--nav::before\s*{[^}]*border-radius:\s*inherit/s);
  });

  it("keeps Hover Base 1 theme-aware, layout-neutral, and motion-safe", () => {
    const interactionsCss = readFileSync(path.join(projectRoot, "src", "styles", "interactions.css"), "utf8");
    const layoutSource = readFileSync(path.join(projectRoot, "src", "app", "layout.tsx"), "utf8");
    const tokensCss = readFileSync(path.join(projectRoot, "src", "styles", "tokens.css"), "utf8");

    expect(layoutSource).toMatch(/import\s+"@\/styles\/interactions\.css"/);
    expect(tokensCss).toMatch(/--hover-base-1-wave-duration:\s*1600ms/);
    expect(tokensCss).toMatch(/--hover-base-1-route-duration:\s*420ms/);
    expect(tokensCss).toMatch(/--hover-base-1-route-easing:\s*cubic-bezier\(0\.65,\s*0,\s*0\.35,\s*1\)/);
    expect(tokensCss).toMatch(/--hover-base-1-hover-surface:\s*linear-gradient\(135deg,\s*#1e4b99,\s*#112d65\)/);
    expect(tokensCss).toMatch(/--hover-base-1-selected-surface:\s*linear-gradient\(135deg,\s*rgba\(30,\s*75,\s*153,\s*0\.28\),\s*rgba\(17,\s*45,\s*101,\s*0\.22\)\)/);
    expect(tokensCss).toMatch(/\[data-theme="light"\][\s\S]*--hover-base-1-hover-surface:\s*linear-gradient\(135deg,\s*#6b7078,\s*#4d5158\)/);
    expect(tokensCss).toMatch(/\[data-theme="light"\][\s\S]*--hover-base-1-selected-surface:\s*linear-gradient\(135deg,\s*rgba\(107,\s*112,\s*120,\s*0\.16\),\s*rgba\(77,\s*81,\s*88,\s*0\.11\)\)/);
    expect(tokensCss).toMatch(/\[data-theme="dark"\][\s\S]*--hover-base-1-hover-surface:\s*linear-gradient\(135deg,\s*#425990,\s*#273965\)/);
    expect(tokensCss).toMatch(/\[data-theme="dark"\][\s\S]*--hover-base-1-selected-surface:\s*linear-gradient\(135deg,\s*rgba\(66,\s*89,\s*144,\s*0\.21\),\s*rgba\(39,\s*57,\s*101,\s*0\.15\)\)/);
    expect(interactionsCss).toMatch(/\.hover-base-1::before,\s*\.hover-base-1::after\s*{[^}]*pointer-events:\s*none/s);
    expect(interactionsCss).toMatch(/\.hover-base-1::before\s*{(?=[^}]*background:\s*var\(--hover-base-1-hover-surface\))(?=[^}]*opacity:\s*0)[^}]*}/s);
    expect(interactionsCss).toMatch(/aria-current="page"[\s\S]*aria-pressed="true"[\s\S]*aria-expanded="true"[\s\S]*data-selected="true"/);
    expect(interactionsCss).toMatch(/\.hover-base-1--inset/);
    expect(interactionsCss).toMatch(/\.hover-base-1--compact/);
    expect(interactionsCss).toMatch(/\.hover-base-1--inline/);
    expect(interactionsCss).toMatch(/\.hover-base-1--solid/);
    expect(interactionsCss).toMatch(/\.hover-base-1--no-wave::after\s*{[^}]*animation:\s*none[^}]*opacity:\s*0/s);
    expect(interactionsCss).toMatch(/\.hover-base-1--route/);
    expect(interactionsCss).toMatch(/@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)[\s\S]*animation:\s*hover-base-1-wave\s+var\(--hover-base-1-wave-duration\)\s+linear\s+infinite/);
    expect(interactionsCss).toMatch(/@keyframes\s+hover-base-1-wave\s*{[\s\S]*transform:\s*translate3d\([^;]+[\s\S]*opacity:/);
    expect(interactionsCss).toMatch(/:active\s*{[^}]*transition-duration:\s*0ms[^}]*transform:\s*translateY\(0\)/s);
    expect(interactionsCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.hover-base-1::after,\s*\.hover-base-1:not\(:disabled\):not\(\[aria-disabled="true"\]\):hover::after\s*{[^}]*animation:\s*none[^}]*opacity:\s*0/s
    );
    expect(interactionsCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.active-route-indicator\s*{[^}]*transition:\s*none[^}]*animation:\s*none/s);
  });

  it("keeps the profile overview hierarchy compact, responsive, and free of resume timelines", () => {
    const portfolioCss = readFileSync(path.join(projectRoot, "src", "styles", "portfolio.css"), "utf8");
    const profileOverviewSource = readFileSync(
      path.join(projectRoot, "src", "components", "portfolio", "ProfileOverviewDetails.tsx"),
      "utf8"
    );
    const detailsRule = portfolioCss.match(/\.profile-overview__details\s*{[^}]*}/s)?.[0] ?? "";
    const shellRule = portfolioCss.match(/\.profile-overview__shell\s*{[^}]*}/s)?.[0] ?? "";
    const photoColumnRule = portfolioCss.match(/\.profile-overview__photo-column\s*{[^}]*}/s)?.[0] ?? "";
    const panelRule = portfolioCss.match(/\.profile-overview__panel\s*{[^}]*}/s)?.[0] ?? "";
    const panelHeaderRule = portfolioCss.match(/\.profile-overview__panel-header\s*{[^}]*}/s)?.[0] ?? "";
    const panelHeaderWithActionRule =
      portfolioCss.match(/\.profile-overview__panel-header--with-action\s*{[^}]*}/s)?.[0] ?? "";
    const panelActionSlotRule = portfolioCss.match(/\.profile-overview__panel-action-slot\s*{[^}]*}/s)?.[0] ?? "";
    const academicGridRule = portfolioCss.match(/\.profile-overview__academic-grid\s*{[^}]*}/s)?.[0] ?? "";
    const academicPanelRule =
      portfolioCss.match(/\.profile-overview__academic-grid\s*>\s*\.profile-overview__panel\s*{[^}]*}/s)?.[0] ?? "";
    const panelActionRule = portfolioCss.match(/\.profile-overview__panel-action\s*{[^}]*}/s)?.[0] ?? "";
    const affiliationMarkRule = portfolioCss.match(/\.profile-overview__affiliation-mark\s*{[^}]*}/s)?.[0] ?? "";
    const academicEntityRule =
      portfolioCss.match(/\.profile-overview__academic-grid\s+\.profile-overview__entity\s*{[^}]*}/s)?.[0] ?? "";
    const academicFooterRule = portfolioCss.match(/\.profile-overview__academic-footer\s*{[^}]*}/s)?.[0] ?? "";
    const researchLinksRule = portfolioCss.match(/\.profile-overview__research-links\s*{[^}]*}/s)?.[0] ?? "";
    const researchLinkRule = portfolioCss.match(/\.profile-overview__research-link\s*{[^}]*}/s)?.[0] ?? "";
    const pendingResearchLinkRule =
      portfolioCss.match(/\.profile-overview__research-link--pending\s*{[^}]*}/s)?.[0] ?? "";
    const researchFactListRule =
      portfolioCss.match(/\.profile-overview__research-fact-list\s*{[^}]*}/s)?.[0] ?? "";
    const researchFactListItemRule =
      portfolioCss.match(/\.profile-overview__research-fact-list li\s*{[^}]*}/s)?.[0] ?? "";
    const roleRule = portfolioCss.match(/\.profile-role\s*{[^}]*}/s)?.[0] ?? "";
    const roleWindowRule = portfolioCss.match(/\.profile-role__window\s*{[^}]*}/s)?.[0] ?? "";
    const prefixWindowRule =
      [...portfolioCss.matchAll(/\.profile-role__prefix-window\s*{[^}]*}/gs)]
        .map(([rule]) => rule)
        .find((rule) => rule.includes("perspective")) ?? "";
    const prefixRule =
      [...portfolioCss.matchAll(/\.profile-role__prefix\s*{[^}]*}/gs)]
        .map(([rule]) => rule)
        .find((rule) => rule.includes("justify-self")) ?? "";
    const movingRoleLayersRule =
      portfolioCss.match(
        /\.profile-role__prefix,\s*\.profile-role__engineer-line,\s*\.profile-role__alternate\s*{[^}]*}/s
      )?.[0] ?? "";

    expect(detailsRule).toMatch(/display:\s*grid/);
    expect(detailsRule).toMatch(/align-content:\s*start/);
    expect(detailsRule).toMatch(/gap:\s*0/);
    expect(detailsRule).toMatch(/min-width:\s*0/);
    expect(detailsRule).not.toMatch(/grid-template-columns/);
    expect(shellRule).toMatch(/align-items:\s*stretch/);
    expect(photoColumnRule).toMatch(/align-content:\s*center/);
    expect(photoColumnRule).toMatch(/align-self:\s*stretch/);

    const introductionIndex = profileOverviewSource.indexOf('className="profile-overview__introduction"');
    const currentWorkIndex = profileOverviewSource.indexOf('className="profile-overview__panel profile-overview__current-work"');
    const academicGridIndex = profileOverviewSource.indexOf('className="profile-overview__academic-grid"');

    expect(introductionIndex).toBeGreaterThan(-1);
    expect(currentWorkIndex).toBeGreaterThan(introductionIndex);
    expect(academicGridIndex).toBeGreaterThan(currentWorkIndex);
    expect(profileOverviewSource).not.toMatch(/profile-overview__supporting-links|Related profile pages/);

    expect(panelRule).toMatch(/display:\s*flex/);
    expect(panelRule).toMatch(/flex-direction:\s*column/);
    expect(panelRule).toMatch(/gap:\s*var\(--space-4\)/);
    expect(panelRule).not.toMatch(/height:\s*100%/);
    expect(panelRule).toMatch(/padding:\s*var\(--space-5\)/);
    expect(panelRule).toMatch(/border:\s*1px solid var\(--color-line\)/);
    expect(panelRule).toMatch(/background:\s*var\(--color-control-surface-soft\)/);
    expect(panelRule).not.toMatch(/backdrop-filter/);
    expect(panelRule).not.toMatch(/box-shadow/);
    expect(panelHeaderRule).toMatch(/position:\s*relative/);
    expect(panelHeaderWithActionRule).toMatch(/padding-inline-end:\s*8\.5rem/);
    expect(panelActionSlotRule).toMatch(/position:\s*absolute/);
    expect(panelActionSlotRule).toMatch(/top:\s*50%/);
    expect(panelActionSlotRule).toMatch(/right:\s*-0\.65rem/);
    expect(panelActionSlotRule).toMatch(/transform:\s*translateY\(-50%\)/);

    expect(academicGridRule).toMatch(/grid-template-areas:\s*"education research"/);
    expect(academicGridRule).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(academicGridRule).toMatch(/gap:\s*var\(--space-6\)/);
    expect(academicGridRule).toMatch(/align-items:\s*stretch/);
    expect(academicGridRule).toMatch(/margin-top:\s*28px/);
    expect(academicPanelRule).toMatch(/height:\s*100%/);
    expect(academicEntityRule).toMatch(/flex:\s*1 1 auto/);
    expect(academicFooterRule).toMatch(/flex:\s*0 0 auto/);
    expect(academicFooterRule).toMatch(/min-height:\s*calc\(36px \+ var\(--space-4\)\)/);
    expect(academicFooterRule).toMatch(/margin-top:\s*auto/);
    expect(academicFooterRule).toMatch(/padding-top:\s*var\(--space-4\)/);
    expect(portfolioCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*{[\s\S]*?\.profile-overview__academic-grid\s*{(?=[^}]*grid-template-areas:\s*"education"\s*"research")(?=[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\))[^}]*}/s
    );

    expect(researchLinksRule).toMatch(/display:\s*flex/);
    expect(researchLinksRule).toMatch(/flex-wrap:\s*wrap/);
    expect(researchLinksRule).toMatch(/align-items:\s*center/);
    expect(researchLinksRule).toMatch(/justify-content:\s*center/);
    expect(researchLinksRule).toMatch(/width:\s*100%/);
    expect(researchLinkRule).toMatch(/display:\s*inline-flex/);
    expect(researchLinkRule).toMatch(/justify-content:\s*center/);
    expect(researchLinkRule).toMatch(/min-height:\s*36px/);
    expect(researchLinkRule).toMatch(/padding:\s*0 var\(--space-3\)/);
    expect(researchLinkRule).toMatch(/border:\s*1px solid transparent/);
    expect(researchLinkRule).toMatch(/background:\s*transparent/);
    expect(researchLinkRule).toMatch(/font-size:\s*var\(--font-size-caption\)/);
    expect(researchLinkRule).toMatch(/text-decoration:\s*none/);
    expect(researchLinkRule).not.toMatch(/underline|text-decoration-color/);
    expect(researchLinkRule).toMatch(/white-space:\s*nowrap/);
    expect(pendingResearchLinkRule).toMatch(/cursor:\s*not-allowed/);
    expect(pendingResearchLinkRule).toMatch(/opacity:\s*0\.62/);
    expect(profileOverviewSource).not.toMatch(/GlassLink|LinkIcon|getLinkKind/);
    expect(profileOverviewSource).toContain(
      '"profile-overview__research-link hover-base-1 hover-base-1--compact hover-base-1--inline"'
    );
    expect(profileOverviewSource).toMatch(/className="profile-overview__panel-action-slot"/);
    expect(profileOverviewSource).toMatch(
      /profile-overview__panel-action hover-base-1 hover-base-1--compact hover-base-1--inline/
    );
    expect(profileOverviewSource).toMatch(/<dl className="profile-overview__academic-details">/);
    expect(profileOverviewSource).toMatch(/<dt>Degree<\/dt>/);
    expect(profileOverviewSource).toMatch(/<dt>Concentration<\/dt>/);
    expect(profileOverviewSource).toMatch(/profile-overview__academic-details profile-overview__research-details/);
    expect(profileOverviewSource).toMatch(/<dt>Position<\/dt>/);
    expect(profileOverviewSource).toMatch(/<dt>Contributions<\/dt>/);
    expect(profileOverviewSource).toMatch(/<dt>Labs<\/dt>/);
    expect(profileOverviewSource).toMatch(/className="profile-overview__research-fact-list"/);
    expect(researchFactListRule).toMatch(/display:\s*grid/);
    expect(researchFactListRule).toMatch(/gap:\s*2px/);
    expect(researchFactListRule).toMatch(/list-style:\s*none/);
    expect(researchFactListItemRule).toMatch(/overflow-wrap:\s*anywhere/);
    expect(profileOverviewSource).toContain("<AffiliationLogo logo={overview.research.logo} />");
    expect(profileOverviewSource.match(/className="profile-overview__entity"/g)).toHaveLength(3);
    expect(profileOverviewSource).toMatch(
      /profile-overview__metadata profile-overview__academic-footer[\s\S]*profile-overview__research-links profile-overview__academic-footer/
    );
    expect(profileOverviewSource).toMatch(/<button[\s\S]*disabled[\s\S]*type="button"/);
    expect(panelActionRule).toMatch(/text-decoration:\s*none/);
    expect(panelActionRule).not.toMatch(/background|border:/);
    expect(affiliationMarkRule).toMatch(/border:\s*0/);
    expect(affiliationMarkRule).toMatch(/background:\s*transparent/);

    expect(roleRule).toMatch(/--profile-role-hold:\s*3400ms/);
    expect(roleRule).toMatch(/--profile-role-duration:\s*640ms/);
    expect(roleRule).toMatch(/--profile-role-offset:\s*8px/);
    expect(roleRule).toMatch(/--profile-role-flip:\s*70deg/);
    expect(roleRule).toMatch(/--profile-role-easing:\s*cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/);
    expect(roleRule).toMatch(/width:\s*max-content/);
    expect(roleRule).toMatch(/max-width:\s*100%/);
    expect(roleWindowRule).toMatch(/overflow:\s*hidden/);
    expect(roleWindowRule).toMatch(/width:\s*100%/);
    expect(roleWindowRule).toMatch(/height:\s*1\.36em/);
    expect(roleWindowRule).toMatch(/mask-image:\s*linear-gradient/);
    expect(roleWindowRule).toMatch(/perspective:\s*700px/);
    expect(prefixWindowRule).toMatch(/perspective:\s*700px/);
    expect(prefixRule).toMatch(/justify-self:\s*end/);
    expect(movingRoleLayersRule).toMatch(/backface-visibility:\s*hidden/);
    expect(movingRoleLayersRule).toMatch(/transform-origin:\s*center center/);
    expect(movingRoleLayersRule).toMatch(/transform-style:\s*preserve-3d/);
    expect(portfolioCss).toMatch(
      /\.profile-role__prefix\[data-state="active"\],[\s\S]*?transform:\s*translateY\(0\)\s*rotateX\(0deg\)/
    );
    expect(portfolioCss).toMatch(
      /\.profile-role__prefix\[data-state="inactive"\],[\s\S]*?transform:\s*translateY\(var\(--profile-role-offset\)\)\s*rotateX\(calc\(-1\s*\*\s*var\(--profile-role-flip\)\)\)/
    );
    expect(portfolioCss).toMatch(
      /\.profile-role__prefix\[data-state="outgoing"\],[\s\S]*?transform:\s*translateY\(calc\(-1\s*\*\s*var\(--profile-role-offset\)\)\)\s*rotateX\(var\(--profile-role-flip\)\)/
    );
    expect(portfolioCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.profile-role__prefix,[\s\S]*?transition:\s*none[\s\S]*?animation:\s*none[\s\S]*?will-change:\s*auto/
    );
    expect(portfolioCss).not.toMatch(/\.profile-role[^}]*filter:\s*blur/s);

    expect(portfolioCss).not.toMatch(/\.profile-overview__timeline-marker/);
    expect(portfolioCss).not.toMatch(/\.profile-overview__organization-entries/);
  });

  it("keeps personal profile values out of the reusable overview component", () => {
    const profileOverviewSource = readFileSync(
      path.join(projectRoot, "src", "components", "portfolio", "ProfileOverviewDetails.tsx"),
      "utf8"
    );

    for (const personalLiteral of [
      "Nicolas Gioanni",
      "Research Assistant",
      "UW Bothell School of STEM",
      "CytoCV",
      "cytocv.uwb.edu",
      "BrentLagesse/CytoCV"
    ]) {
      expect(profileOverviewSource).not.toContain(personalLiteral);
    }
  });

  it("keeps project, skill, and recommendation Home cards structured and motion-safe", () => {
    const portfolioCss = readFileSync(path.join(projectRoot, "src", "styles", "portfolio.css"), "utf8");
    const projectSource = readFileSync(
      path.join(projectRoot, "src", "components", "portfolio", "HomeProjectCard.tsx"),
      "utf8"
    );
    const projectSkillSource = readFileSync(
      path.join(projectRoot, "src", "components", "portfolio", "ProjectSkillShowcase.tsx"),
      "utf8"
    );
    const recommendationSource = readFileSync(
      path.join(projectRoot, "src", "components", "portfolio", "RecommendationCard.tsx"),
      "utf8"
    );
    const skillsGridRule = portfolioCss.match(/\.skills-cloud--compact\s*{[^}]*}/s)?.[0] ?? "";
    const skillPanelRule = portfolioCss.match(/\.skills-group--compact\s*{[^}]*}/s)?.[0] ?? "";
    const projectSkillsRule = portfolioCss.match(/\.home-project-card__skills\s*{[^}]*}/s)?.[0] ?? "";
    const projectShowcaseRule =
      portfolioCss.match(/\.home-project-card__skills\s+\.project-skill-showcase\s*{[^}]*}/s)?.[0] ?? "";
    const projectBadgeRule =
      portfolioCss.match(/\.home-project-card__skills\s+\.skill-badge\s*{[^}]*}/s)?.[0] ?? "";
    const projectBadgeLabelRule =
      portfolioCss.match(/\.home-project-card__skills\s+\.skill-badge__label\s*{[^}]*}/s)?.[0] ?? "";
    const projectActionsRule = portfolioCss.match(/\.home-project-card__actions\s*{[^}]*}/s)?.[0] ?? "";
    const researchActionsRule = portfolioCss.match(/\.home-research-card__actions\s*{[^}]*}/s)?.[0] ?? "";
    const projectSubtitleRule = portfolioCss.match(/\.home-project-card__subtitle\s*{[^}]*}/s)?.[0] ?? "";
    const projectSkillDialogRule = portfolioCss.match(/\.project-skill-dialog\s*{[^}]*}/s)?.[0] ?? "";
    const projectSkillDialogFrameRule =
      portfolioCss.match(/\.project-skill-dialog__frame\s*{[^}]*}/s)?.[0] ?? "";
    const recommendationViewportRule =
      portfolioCss.match(/\.recommendation-expandable__viewport\s*{[^}]*}/s)?.[0] ?? "";
    const recommendationGridRule = portfolioCss.match(/\.home-recommendations__grid\s*{[^}]*}/s)?.[0] ?? "";
    const recommendationCardRule = portfolioCss.match(/\.recommendation-card\s*{[^}]*}/s)?.[0] ?? "";
    const recommendationExpandableRule =
      portfolioCss.match(/(?:^|\n)\.recommendation-expandable\s*{[^}]*}/s)?.[0] ?? "";
    const recommendationDividerRule =
      portfolioCss.match(/\.recommendation-expandable::before\s*{[^}]*}/s)?.[0] ?? "";
    const recommendationMaskRule =
      portfolioCss.match(
        /\.recommendation-expandable\[data-can-expand="true"\]\[data-expanded="false"\] \.recommendation-expandable__viewport\s*{[^}]*}/s
      )?.[0] ?? "";
    const recommendationQuoteRule =
      portfolioCss.match(/\.recommendation-expandable__quote\s*{\s*color:[^}]*}/s)?.[0] ?? "";
    const recommendationLinkRule =
      portfolioCss.match(/\.recommendation-card__links \.glass-icon-link\s*{[^}]*}/s)?.[0] ?? "";
    const researchSummaryRule =
      portfolioCss.match(/\.home-research-card__summary\s*{\s*color:[^}]*}/s)?.[0] ?? "";
    const projectSummaryRule =
      portfolioCss.match(/\.home-project-card__summary\s*{\s*color:[^}]*}/s)?.[0] ?? "";
    const homeCardSummaryPositionRule =
      portfolioCss.match(/\.home-research-card__summary,\s*\.home-project-card__summary\s*{[^}]*}/s)?.[0] ?? "";
    const homeCardDividerRule =
      portfolioCss.match(
        /\.home-research-card__summary::before,\s*\.home-project-card__summary::before\s*{[^}]*}/s
      )?.[0] ?? "";

    expect(projectSource).toMatch(/item\.homeSkills\.slice\(0,\s*3\)/);
    expect(projectSource).toMatch(/ProjectSkillShowcase/);
    expect(projectSource).toMatch(/projectTitle=\{item\.title\}\s+skills=\{visibleSkills\}/);
    expect(projectSource).not.toMatch(/<SkillBadge|visibleSkills\.map/);
    expect(projectSource).toMatch(/Source code[\s\S]*Live demo/);
    expect(projectSource).not.toMatch(/Featured|GlassChip/);
    expect(projectSkillsRule).toMatch(/justify-content:\s*center/);
    expect(projectSkillsRule).toMatch(/width:\s*100%/);
    expect(projectShowcaseRule).toMatch(/display:\s*flex/);
    expect(projectShowcaseRule).toMatch(/flex-wrap:\s*nowrap/);
    expect(projectShowcaseRule).toMatch(/justify-content:\s*center/);
    expect(projectShowcaseRule).toMatch(/max-width:\s*100%/);
    expect(projectBadgeRule).toMatch(/min-height:\s*32px/);
    expect(projectBadgeRule).toMatch(/padding:\s*5px 7px/);
    expect(projectBadgeLabelRule).toMatch(/font-size:\s*0\.6875rem/);
    expect(projectBadgeLabelRule).toMatch(/white-space:\s*nowrap/);
    expect(portfolioCss).toMatch(
      /@media\s*\(max-width:\s*620px\)[\s\S]*?\.home-project-card__skills\s+\.project-skill-showcase\s*{[^}]*flex-wrap:\s*wrap[^}]*}/s
    );
    expect(projectActionsRule).toMatch(/justify-content:\s*center/);
    expect(researchActionsRule).toMatch(/justify-content:\s*center/);
    expect(projectSubtitleRule).toMatch(/color:\s*var\(--color-muted\)/);
    expect(projectSubtitleRule).toMatch(/font-weight:\s*var\(--font-weight-medium\)/);
    expect(projectSkillSource).toMatch(/createPortal\(dialog,\s*document\.body\)/);
    expect(projectSkillSource).toMatch(/aria-haspopup="dialog"/);
    expect(projectSkillSource).toMatch(/aria-modal="true"/);
    expect(projectSkillSource).toMatch(/projectSkillDialogFadeMs\s*=\s*180/);
    expect(projectSkillDialogRule).toMatch(/position:\s*fixed/);
    expect(projectSkillDialogRule).toMatch(/inset:\s*0/);
    expect(projectSkillDialogRule).toMatch(/transition:\s*opacity 180ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/);
    expect(projectSkillDialogFrameRule).toMatch(/max-height:/);
    expect(projectSkillDialogFrameRule).toMatch(/overflow-y:\s*auto/);
    expect(portfolioCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.project-skill-dialog,[\s\S]*?\.project-skill-dialog__frame\s*{[^}]*transition:\s*none/s
    );
    expect(skillsGridRule).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(skillsGridRule).toMatch(/align-items:\s*stretch/);
    expect(skillPanelRule).toMatch(/height:\s*100%/);
    expect(recommendationSource).toMatch(/const quote = item\.fullQuote/);
    expect(recommendationSource).toMatch(/ExpandableRecommendationText/);
    expect(recommendationSource).not.toMatch(/createRecommendationExcerpt|GlassChip/);
    expect(recommendationGridRule).toMatch(/align-items:\s*start/);
    expect(recommendationCardRule).toMatch(/align-self:\s*start/);
    expect(recommendationCardRule).toMatch(/height:\s*auto/);
    expect(recommendationExpandableRule).toMatch(/position:\s*relative/);
    expect(recommendationDividerRule).toMatch(/right:\s*var\(--space-2\)/);
    expect(recommendationDividerRule).toMatch(/left:\s*var\(--space-2\)/);
    expect(recommendationDividerRule).toMatch(/height:\s*1px/);
    expect(recommendationDividerRule).toMatch(/background:\s*var\(--gradient-divider\)/);
    expect(recommendationViewportRule).toMatch(/overflow:\s*hidden/);
    expect(recommendationViewportRule).toMatch(
      /transition:\s*max-height 520ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/
    );
    expect(recommendationMaskRule).toMatch(/-webkit-mask-image:\s*linear-gradient/);
    expect(recommendationMaskRule).toMatch(/mask-image:\s*linear-gradient/);
    expect(recommendationMaskRule).toMatch(/transparent 100%/);
    expect(portfolioCss).not.toMatch(/\.recommendation-expandable__viewport::after/);
    expect(recommendationQuoteRule).toMatch(/font-size:\s*var\(--font-size-body\)/);
    expect(recommendationQuoteRule).toMatch(
      /transition:\s*opacity 320ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/
    );
    expect(recommendationQuoteRule).toMatch(
      /transition:\s*opacity 320ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/
    );
    expect(researchSummaryRule).toMatch(/font-size:\s*var\(--font-size-body\)/);
    expect(projectSummaryRule).toMatch(/font-size:\s*var\(--font-size-body\)/);
    expect(homeCardSummaryPositionRule).toMatch(/position:\s*relative/);
    expect(homeCardDividerRule).toMatch(/top:\s*calc\(-1 \* var\(--space-2\)\)/);
    expect(homeCardDividerRule).toMatch(/right:\s*var\(--space-2\)/);
    expect(homeCardDividerRule).toMatch(/left:\s*var\(--space-2\)/);
    expect(homeCardDividerRule).toMatch(/height:\s*1px/);
    expect(homeCardDividerRule).toMatch(/pointer-events:\s*none/);
    expect(homeCardDividerRule).toMatch(/background:\s*var\(--gradient-divider\)/);
    expect(homeCardDividerRule).toMatch(/opacity:\s*0\.65/);
    expect(recommendationLinkRule).toMatch(/width:\s*auto/);
    expect(recommendationLinkRule).toMatch(/min-height:\s*36px/);
    expect(recommendationLinkRule).toMatch(/font-size:\s*var\(--font-size-caption\)/);
    expect(portfolioCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.recommendation-expandable__viewport[\s\S]*transition:\s*none/
    );
    expect(portfolioCss).not.toMatch(/\.recommendation-expandable[^}]*filter:\s*blur/s);
  });

  it("keeps the header theme disclosure tokenized, pointer-safe, and motion-safe", () => {
    const footerSource = readFileSync(path.join(projectRoot, "src", "components", "layout", "BlobFooter.tsx"), "utf8");
    const navigationCss = readFileSync(path.join(projectRoot, "src", "styles", "navigation.css"), "utf8");
    const themeSource = readFileSync(path.join(projectRoot, "src", "components", "theme", "ThemeSwitcher.tsx"), "utf8");

    expect(themeSource).toMatch(/const themeMenuOrder:\s*ThemeName\[\]\s*=\s*\["light",\s*"navy",\s*"dark"\]/);
    expect(themeSource).toMatch(/aria-expanded=\{open\}/);
    expect(themeSource).toMatch(/aria-pressed=\{selectedTheme === theme\}/);
    expect(themeSource).toMatch(/aria-label="Color theme"[\s\S]*role="group"/);
    expect(navigationCss).toMatch(
      /\.theme-switcher__popover\s*{(?=[^}]*padding:\s*20px\s+12px\s+12px)(?=[^}]*opacity:\s*0)(?=[^}]*pointer-events:\s*none)(?=[^}]*transform:\s*translate3d\(0,\s*-4px,\s*0\)\s*scale\(0\.985\))[^}]*}/s
    );
    expect(navigationCss).toMatch(
      /\.theme-switcher__popover\[data-state="open"\]\s*{(?=[^}]*opacity:\s*1)(?=[^}]*pointer-events:\s*auto)(?=[^}]*transform:\s*translate3d\(0,\s*0,\s*0\)\s*scale\(1\))[^}]*}/s
    );
    expect(navigationCss).toMatch(
      /\.theme-switcher__panel\s*{(?=[^}]*border:\s*1px solid var\(--color-line\))(?=[^}]*background:\s*var\(--color-menu-surface\))(?=[^}]*box-shadow:\s*var\(--shadow-soft\))[^}]*}/s
    );
    expect(navigationCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.theme-switcher__popover,[\s\S]*\.theme-switcher__popover\[data-state="open"\]\s*{[^}]*transform:\s*none/s
    );
    expect(footerSource).not.toMatch(/ThemeSwitcher/);
  });

  it("keeps the profile preview centered with a polished close button", () => {
    const navigationCss = readFileSync(path.join(projectRoot, "src", "styles", "navigation.css"), "utf8");
    const previewSource = readFileSync(
      path.join(projectRoot, "src", "components", "layout", "ProfileImagePreview.tsx"),
      "utf8"
    );

    expect(navigationCss).toMatch(/\.profile-image-preview\s*{(?=[^}]*place-items:\s*center)(?=[^}]*opacity:\s*0)(?=[^}]*transition:\s*opacity 160ms ease)[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview\[data-state="open"\]\s*{(?=[^}]*opacity:\s*1)(?=[^}]*pointer-events:\s*auto)[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview__frame\s*{(?=[^}]*display:\s*grid)(?=[^}]*grid-template-rows:\s*auto auto)(?=[^}]*place-items:\s*center)(?=[^}]*opacity:\s*0)(?=[^}]*transform:\s*translateY\(-6px\)\s*scale\(0\.98\))(?=[^}]*transition:[^}]*opacity 160ms ease,[^}]*transform 160ms ease)[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview\[data-state="open"\]\s+\.profile-image-preview__frame\s*{(?=[^}]*opacity:\s*1)(?=[^}]*transform:\s*translateY\(0\)\s*scale\(1\))[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview__actions\s*{(?=[^}]*display:\s*flex)(?=[^}]*justify-content:\s*flex-end)(?=[^}]*width:\s*100%)[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview__close\s*{(?=[^}]*display:\s*inline-flex)(?=[^}]*align-items:\s*center)(?=[^}]*justify-content:\s*center)(?=[^}]*min-width:\s*62px)(?=[^}]*line-height:\s*1)(?=[^}]*background:\s*var\(--color-control-surface\))(?=[^}]*box-shadow:\s*var\(--shadow-card\))[^}]*}/s);
    expect(navigationCss).not.toMatch(/\.profile-image-preview__close\s*{[^}]*(?:position:\s*absolute|top:|bottom:|right:)/s);
    expect(previewSource).toMatch(
      /className="profile-image-preview__close hover-base-1 hover-base-1--compact"/
    );
    expect(navigationCss).not.toMatch(/\.profile-image-preview__close:hover/);
    expect(navigationCss).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.profile-image-preview,[\s\S]*\.profile-image-preview__close[\s\S]*transition:\s*none/);
    expect(navigationCss).not.toMatch(/@keyframes\s+profile-image-preview-in/);
  });
});
