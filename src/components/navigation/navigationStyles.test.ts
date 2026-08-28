import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const navigationStyles = readFileSync(path.join(process.cwd(), "src", "styles", "navigation.css"), "utf8");

describe("responsive navigation styles", () => {
  it("uses a short opacity-and-translation menu fade with a delayed closed visibility state", () => {
    const panelRule = navigationStyles.match(/\.mobile-navigation__panel\s*\{[^}]*}/s)?.[0] ?? "";
    const openRule = navigationStyles.match(/\.mobile-navigation__panel\[data-state="open"\]\s*\{[^}]*}/s)?.[0] ?? "";

    expect(panelRule).toMatch(/visibility:\s*hidden/);
    expect(panelRule).toMatch(/opacity:\s*0/);
    expect(panelRule).toMatch(/pointer-events:\s*none/);
    expect(panelRule).toMatch(/transform:\s*translateY\(-3px\)/);
    expect(panelRule).toMatch(/opacity 160ms ease/);
    expect(panelRule).toMatch(/visibility 0s linear 160ms/);
    expect(panelRule).not.toMatch(/transition:[^}]*(?:backdrop-filter|blur|width|height|top|right|padding|box-shadow)/s);

    expect(openRule).toMatch(/visibility:\s*visible/);
    expect(openRule).toMatch(/opacity:\s*1/);
    expect(openRule).toMatch(/pointer-events:\s*auto/);
    expect(openRule).toMatch(/transform:\s*translateY\(0\)/);
  });

  it("removes only header geometry morphs in mobile UI mode and neutralizes a stale compact class", () => {
    expect(navigationStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.blob-header,[\s\S]*?\.mobile-navigation__button,[\s\S]*?\.theme-switcher__trigger\s*\{\s*transition:\s*none/
    );
    expect(navigationStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.blob-header--compact\s*\{[^}]*width:\s*min\(var\(--header-full-width\), calc\(100% - 32px\)\)[^}]*transform:\s*translateY\(0\) scale\(1\)/
    );
    expect(navigationStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.blob-header--compact \.mobile-navigation__button\s*\{[^}]*min-height:\s*42px[^}]*padding:\s*0 var\(--space-4\)/
    );
    expect(navigationStyles).toMatch(
      /@media \(max-width: 520px\)[\s\S]*?\.blob-header__island,\s*\.blob-header--compact \.blob-header__island\s*\{[^}]*padding:\s*var\(--space-2\)/
    );
  });

  it("makes the menu state change immediate for reduced motion", () => {
    expect(navigationStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.mobile-navigation__panel,[\s\S]*?\{\s*transition:\s*none/
    );
    expect(navigationStyles).toMatch(
      /\.mobile-navigation__panel,\s*\.mobile-navigation__panel\[data-state="open"\]\s*\{\s*transform:\s*none/
    );
  });
});
