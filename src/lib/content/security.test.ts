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
    const panelRule = portfolioCss.match(/\.profile-overview__panel\s*{[^}]*}/s)?.[0] ?? "";
    const academicGridRule = portfolioCss.match(/\.profile-overview__academic-grid\s*{[^}]*}/s)?.[0] ?? "";
    const researchLinksRule = portfolioCss.match(/\.profile-overview__research-links\s*{[^}]*}/s)?.[0] ?? "";
    const researchLinkRule = portfolioCss.match(/\.profile-overview__research-link\s*{[^}]*}/s)?.[0] ?? "";
    const supportingLinkRule = portfolioCss.match(/\.profile-overview__supporting-link\s*{[^}]*}/s)?.[0] ?? "";

    expect(detailsRule).toMatch(/display:\s*grid/);
    expect(detailsRule).toMatch(/align-content:\s*start/);
    expect(detailsRule).toMatch(/gap:\s*var\(--space-8\)/);
    expect(detailsRule).toMatch(/min-width:\s*0/);
    expect(detailsRule).not.toMatch(/grid-template-columns/);

    const introductionIndex = profileOverviewSource.indexOf('className="profile-overview__introduction"');
    const currentWorkIndex = profileOverviewSource.indexOf('className="profile-overview__panel profile-overview__current-work"');
    const academicGridIndex = profileOverviewSource.indexOf('className="profile-overview__academic-grid"');
    const supportingLinksIndex = profileOverviewSource.indexOf('className="profile-overview__supporting-links"');

    expect(introductionIndex).toBeGreaterThan(-1);
    expect(currentWorkIndex).toBeGreaterThan(introductionIndex);
    expect(academicGridIndex).toBeGreaterThan(currentWorkIndex);
    expect(supportingLinksIndex).toBeGreaterThan(academicGridIndex);

    expect(panelRule).toMatch(/gap:\s*var\(--space-4\)/);
    expect(panelRule).toMatch(/padding:\s*var\(--space-5\)/);
    expect(panelRule).toMatch(/border:\s*1px solid var\(--color-line\)/);
    expect(panelRule).toMatch(/background:\s*var\(--color-control-surface-soft\)/);
    expect(panelRule).not.toMatch(/backdrop-filter/);
    expect(panelRule).not.toMatch(/box-shadow/);

    expect(academicGridRule).toMatch(/grid-template-areas:\s*"education research"/);
    expect(academicGridRule).toMatch(/grid-template-columns:\s*minmax\(230px,\s*0\.8fr\)\s+minmax\(0,\s*1\.2fr\)/);
    expect(academicGridRule).toMatch(/gap:\s*var\(--space-6\)/);
    expect(academicGridRule).toMatch(/align-items:\s*start/);
    expect(portfolioCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*{[\s\S]*?\.profile-overview__academic-grid\s*{(?=[^}]*grid-template-areas:\s*"research"\s*"education")(?=[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\))[^}]*}/s
    );

    expect(researchLinksRule).toMatch(/display:\s*flex/);
    expect(researchLinksRule).toMatch(/flex-wrap:\s*wrap/);
    expect(researchLinkRule).toMatch(/min-height:\s*40px/);
    expect(supportingLinkRule).toMatch(/min-height:\s*40px/);
    expect(researchLinkRule).toMatch(/overflow-wrap:\s*anywhere/);
    expect(researchLinkRule).toMatch(/white-space:\s*normal/);
    expect(portfolioCss).toMatch(
      /@media\s*\(max-width:\s*620px\)[\s\S]*?\.profile-overview__research-link,\s*\.profile-overview__supporting-link\s*{[^}]*min-height:\s*44px[^}]*}/s
    );

    expect(portfolioCss).not.toMatch(/\.profile-overview__timeline-marker/);
    expect(portfolioCss).not.toMatch(/\.profile-overview__organization-entries/);
    expect(portfolioCss).not.toMatch(/(?:button\s*)?\.profile-overview__research-link(?::|\[[^\]]+\])*:disabled/);
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
      "cytocv2.uwb.edu",
      "BrentLagesse/CytoCV"
    ]) {
      expect(profileOverviewSource).not.toContain(personalLiteral);
    }
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
