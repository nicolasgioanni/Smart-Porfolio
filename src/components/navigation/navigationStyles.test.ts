import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

const navigationStyles = readSource("src", "styles", "navigation.css");
const baseStyles = readSource("src", "styles", "base.css");
const layoutStyles = readSource("src", "styles", "layout.css");
const tokenStyles = readSource("src", "styles", "tokens.css");
const rootLayout = readSource("src", "app", "layout.tsx");

const mobileStyles = navigationStyles.slice(
  navigationStyles.indexOf("@media (max-width: 980px)"),
  navigationStyles.indexOf("@media (max-width: 720px)")
);
const phoneStyles = navigationStyles.slice(
  navigationStyles.indexOf("@media (max-width: 520px)"),
  navigationStyles.indexOf("@media (prefers-reduced-motion: reduce)")
);
const reducedMotionStyles = navigationStyles.slice(
  navigationStyles.indexOf("@media (prefers-reduced-motion: reduce)")
);

describe("responsive navigation styles", () => {
  it("keeps desktop navigation sticky and turns only the mobile breakpoint into a safe-area bottom dock", () => {
    expect(navigationStyles).toMatch(
      /\.blob-header\s*\{(?=[^}]*position:\s*sticky)(?=[^}]*top:\s*var\(--space-4\))(?=[^}]*width:\s*min\(var\(--header-full-width\), calc\(100% - 32px\)\))[^}]*\}/
    );
    expect(mobileStyles).toMatch(
      /\.blob-header,\s*\.blob-header--compact\s*\{(?=[^}]*position:\s*fixed)(?=[^}]*top:\s*auto)(?=[^}]*right:\s*calc\(var\(--space-3\) \+ env\(safe-area-inset-right, 0px\)\))(?=[^}]*bottom:\s*calc\(var\(--space-3\) \+ env\(safe-area-inset-bottom, 0px\)\))(?=[^}]*left:\s*calc\(var\(--space-3\) \+ env\(safe-area-inset-left, 0px\)\))(?=[^}]*width:\s*auto)(?=[^}]*margin:\s*0)[^}]*\}/
    );
    expect(phoneStyles).toMatch(
      /\.blob-header,\s*\.blob-header--compact\s*\{(?=[^}]*top:\s*auto)(?=[^}]*right:\s*calc\(10px \+ env\(safe-area-inset-right, 0px\)\))(?=[^}]*bottom:\s*calc\(10px \+ env\(safe-area-inset-bottom, 0px\)\))(?=[^}]*left:\s*calc\(10px \+ env\(safe-area-inset-left, 0px\)\))(?=[^}]*width:\s*auto)(?=[^}]*margin:\s*0)[^}]*\}/
    );
  });

  it("uses a constrained route rail beside persistent compact actions", () => {
    expect(mobileStyles).toMatch(
      /\.blob-header__island,\s*\.blob-header--compact \.blob-header__island\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/
    );
    expect(mobileStyles).toMatch(/\.site-brand,\s*\.main-navigation\s*\{[^}]*display:\s*none/);
    expect(mobileStyles).toMatch(
      /\.mobile-navigation\s*\{(?=[^}]*grid-column:\s*1)(?=[^}]*display:\s*block)(?=[^}]*min-width:\s*0)(?=[^}]*overflow:\s*hidden)[^}]*\}/
    );
    expect(mobileStyles).toMatch(
      /\.blob-header__actions,\s*\.blob-header--compact \.blob-header__actions\s*\{(?=[^}]*grid-column:\s*2)(?=[^}]*flex:\s*0 0 auto)(?=[^}]*min-width:\s*max-content)[^}]*\}/
    );
    expect(mobileStyles).toMatch(
      /\.blob-header \.social-link-group,\s*\.blob-header--compact \.social-link-group\s*\{(?=[^}]*display:\s*flex)(?=[^}]*flex:\s*0 0 auto)(?=[^}]*flex-wrap:\s*nowrap)[^}]*\}/
    );
    expect(mobileStyles).toMatch(
      /\.blob-header \.theme-switcher__trigger,\s*\.blob-header--compact \.theme-switcher__trigger\s*\{[^}]*width:\s*38px[^}]*min-height:\s*38px/
    );
  });

  it("provides native swipe overflow, snapping, padded ends, and full route targets", () => {
    expect(mobileStyles).toMatch(
      /\.mobile-navigation__rail\s*\{(?=[^}]*padding:\s*0 var\(--space-2\))(?=[^}]*overflow-x:\s*auto)(?=[^}]*overflow-y:\s*hidden)(?=[^}]*overscroll-behavior-inline:\s*contain)(?=[^}]*scroll-behavior:\s*auto)(?=[^}]*scroll-padding-inline:\s*var\(--space-2\))(?=[^}]*scroll-snap-type:\s*inline proximity)(?=[^}]*scrollbar-width:\s*none)(?=[^}]*touch-action:\s*pan-x pan-y)[^}]*\}/
    );
    expect(mobileStyles).toMatch(/\.mobile-navigation__rail::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
    expect(mobileStyles).toMatch(
      /\.mobile-navigation__rail\[data-automating\]\s*\{[^}]*scroll-snap-type:\s*none/
    );
    expect(mobileStyles).toMatch(
      /\.mobile-navigation__link\s*\{(?=[^}]*flex:\s*0 0 auto)(?=[^}]*min-height:\s*44px)(?=[^}]*scroll-snap-align:\s*start)(?=[^}]*white-space:\s*nowrap)[^}]*\}/
    );
  });

  it("changes the rail fade mask for every measured edge state", () => {
    expect(mobileStyles).toMatch(
      /\.mobile-navigation__rail\[data-edge="end"\]\s*\{[^}]*mask-image:\s*linear-gradient\(to right, #000 0, #000 calc\(100% - 24px\), transparent 100%\)/
    );
    expect(mobileStyles).toMatch(
      /\.mobile-navigation__rail\[data-edge="both"\]\s*\{[^}]*mask-image:\s*linear-gradient\(to right, transparent 0, #000 24px, #000 calc\(100% - 24px\), transparent 100%\)/
    );
    expect(mobileStyles).toMatch(
      /\.mobile-navigation__rail\[data-edge="start"\]\s*\{[^}]*mask-image:\s*linear-gradient\(to right, transparent 0, #000 24px, #000 100%\)/
    );
    expect(mobileStyles).toMatch(/\.mobile-navigation__rail\[data-edge="none"\]\s*\{[^}]*mask-image:\s*none/);
  });

  it("opens the mobile theme menu upward from the action edge", () => {
    expect(mobileStyles).toMatch(
      /\.theme-switcher__popover\s*\{(?=[^}]*top:\s*auto)(?=[^}]*bottom:\s*calc\(100% - 1px\))(?=[^}]*transform-origin:\s*bottom right)[^}]*\}/
    );
  });

  it("reserves safe page-end space and opts into edge-to-edge viewport insets", () => {
    expect(tokenStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?--mobile-dock-clearance:\s*calc\(5\.5rem \+ env\(safe-area-inset-bottom, 0px\)\)[\s\S]*?--scroll-margin-top:\s*var\(--space-4\)/
    );
    expect(baseStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?html\s*\{[^}]*scroll-padding-bottom:\s*var\(--mobile-dock-clearance\)[\s\S]*?\[id\]\s*\{[^}]*scroll-margin-bottom:\s*var\(--mobile-dock-clearance\)/
    );
    expect(layoutStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.site-shell\s*\{[^}]*padding-bottom:\s*var\(--mobile-dock-clearance\)/
    );
    expect(rootLayout).toMatch(/export const viewport:\s*Viewport\s*=\s*\{[^}]*viewportFit:\s*"cover"/s);
  });

  it("keeps manual overflow while removing rail smoothing for reduced motion", () => {
    expect(reducedMotionStyles).toMatch(
      /\.mobile-navigation__rail,\s*\.mobile-navigation__link,[\s\S]*?\{\s*transition:\s*none/
    );
    expect(reducedMotionStyles).toMatch(/\.mobile-navigation__rail\s*\{[^}]*scroll-behavior:\s*auto/);
    expect(mobileStyles).toMatch(/\.mobile-navigation__rail\s*\{[^}]*overflow-x:\s*auto/);
  });

  it("removes obsolete mobile disclosure styles", () => {
    expect(navigationStyles).not.toMatch(/\.mobile-navigation__(?:button|panel|links|social)/);
  });
});
