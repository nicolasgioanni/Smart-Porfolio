import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const tokenStyles = readFileSync(path.join(projectRoot, "src", "styles", "tokens.css"), "utf8");
const glassStyles = readFileSync(path.join(projectRoot, "src", "styles", "glass.css"), "utf8");
const layoutStyles = readFileSync(path.join(projectRoot, "src", "styles", "layout.css"), "utf8");
const contactStyles = readFileSync(path.join(projectRoot, "src", "styles", "contact.css"), "utf8");
const styleSources = [
  "base.css",
  "contact.css",
  "detail.css",
  "dialog.css",
  "experience.css",
  "glass.css",
  "interactions.css",
  "layout.css",
  "motion.css",
  "navigation.css",
  "portfolio.css",
  "research.css",
  "skeletons.css",
  "tokens.css",
  "utilities.css"
].map((fileName) => readFileSync(path.join(projectRoot, "src", "styles", fileName), "utf8"));

const themePatterns = {
  dark: /\[data-theme="dark"\]\s*\{([\s\S]*?)\r?\n\}/,
  light: /\[data-theme="light"\]\s*\{([\s\S]*?)\r?\n\}/,
  navy: /:root,\s*\[data-theme="navy"\]\s*\{([\s\S]*?)\r?\n\}/
} as const;

type ThemeKey = keyof typeof themePatterns;

function readThemeTokens(theme: ThemeKey) {
  const block = tokenStyles.match(themePatterns[theme])?.[1];
  if (!block) throw new Error(`Missing ${theme} theme block`);

  return new Map(
    [...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((match) => [
      match[1]!,
      match[2]!.trim()
    ])
  );
}

function relativeLuminance(hexColor: string) {
  const channels = hexColor
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(firstColor: string, secondColor: string) {
  const firstLuminance = relativeLuminance(firstColor);
  const secondLuminance = relativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

const palettes = {
  dark: readThemeTokens("dark"),
  light: readThemeTokens("light"),
  navy: readThemeTokens("navy")
};

describe("theme palette contract", () => {
  it("keeps native browser controls aligned with each resolved palette", () => {
    expect(tokenStyles.match(themePatterns.light)?.[1]).toMatch(/color-scheme:\s*light/);
    expect(tokenStyles.match(themePatterns.navy)?.[1]).toMatch(/color-scheme:\s*dark/);
    expect(tokenStyles.match(themePatterns.dark)?.[1]).toMatch(/color-scheme:\s*dark/);
  });

  it("defines the same complete semantic contract in every theme", () => {
    const expectedTokenNames = [...palettes.navy.keys()];

    expect(expectedTokenNames.length).toBeGreaterThan(70);
    expect([...palettes.light.keys()]).toEqual(expectedTokenNames);
    expect([...palettes.dark.keys()]).toEqual(expectedTokenNames);
  });

  it("keeps each mode's core layers and accents intentionally distinct", () => {
    const coreTokens = [
      "--color-background",
      "--color-background-elevated",
      "--color-glass-surface",
      "--color-card-surface",
      "--color-card-surface-strong",
      "--color-header-surface",
      "--color-menu-surface",
      "--color-accent",
      "--color-primary-button-surface",
      "--color-brand-mark-surface"
    ];

    for (const token of coreTokens) {
      expect(new Set(Object.values(palettes).map((palette) => palette.get(token))).size).toBe(3);
    }

    expect(palettes.light.get("--color-background")).toBe("#f8f4eb");
    expect(palettes.light.get("--color-text-strong")).toBe("#0b2942");
    expect(palettes.navy.get("--color-background")).toBe("#071423");
    expect(palettes.navy.get("--color-accent")).toBe("#f4f1ea");
    expect(palettes.navy.get("--color-text-strong")).toBe("#fcfaf5");
    expect(palettes.navy.get("--color-text-secondary")).toBe("#cecdc7");
    expect(palettes.dark.get("--color-background")).toBe("#0c0d10");
    expect(palettes.dark.get("--color-accent-warm")).toBe("#c3a6ff");
  });

  it("uses distinct solid surface tiers instead of a uniform canvas", () => {
    const tierTokens = [
      "--color-background",
      "--color-background-elevated",
      "--color-glass-surface",
      "--color-glass-surface-strong",
      "--color-card-surface",
      "--color-card-surface-strong",
      "--color-header-surface"
    ];

    for (const palette of Object.values(palettes)) {
      const tiers = tierTokens.map((token) => palette.get(token)!);

      expect(tiers.every((tier) => /^#[\da-f]{6}$/i.test(tier))).toBe(true);
      expect(new Set(tiers).size).toBeGreaterThanOrEqual(5);
    }

    expect(palettes.light.get("--color-glass-surface")).not.toBe(palettes.light.get("--color-card-surface"));
    expect(palettes.dark.get("--color-glass-surface")).not.toBe(palettes.dark.get("--color-card-surface"));
  });

  it("maintains readable text, links, and actions on their solid palette layers", () => {
    for (const palette of Object.values(palettes)) {
      const background = palette.get("--color-background")!;

      expect(contrastRatio(palette.get("--color-text-primary")!, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.get("--color-text-secondary")!, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.get("--color-text-strong")!, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.get("--color-accent")!, background)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(palette.get("--color-accent-strong")!, palette.get("--color-glass-surface")!)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(
          palette.get("--color-control-border")!,
          palette.get("--color-background-elevated")!
        )
      ).toBeGreaterThanOrEqual(3);

      expect(
        contrastRatio(
          palette.get("--color-primary-button-text")!,
          palette.get("--color-primary-button-surface")!
        )
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(
          palette.get("--hover-base-1-hover-text")!,
          palette.get("--hover-base-1-hover-surface")!
        )
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(palette.get("--hover-base-1-inline-link-text")!, background)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses high-visibility focus rings with solid component tiers", () => {
    for (const palette of Object.values(palettes)) {
      expect(palette.get("--focus-ring")).toMatch(/0 0 0 2px.+0 0 0 5px/);
      expect(palette.get("--contact-field-focus-ring")).toMatch(/0 0 0 2px.+0 0 0 5px/);
    }

    expect(glassStyles).toMatch(/\.glass-card\s*{[^}]*background:\s*var\(--color-card-surface\)/s);
    expect(glassStyles).toMatch(/\.glass-blob--nav\s*{[^}]*background:\s*var\(--color-header-surface\)/s);
    expect(glassStyles).toMatch(/\.site-shell\[data-glass-effects="false"\][\s\S]*background:\s*var\(--glass-fallback-surface\)/);
    expect(layoutStyles).not.toMatch(/gradient|::before\s*{[^}]*background:/s);
    expect(contactStyles).not.toMatch(/field-inset-highlight|inset 0 1px 0/);
  });

  it("keeps UI styles free of decorative gradients, glows, blur, and mask fades", () => {
    for (const styleSource of styleSources) {
      expect(styleSource).not.toMatch(/(?:linear|radial|conic)-gradient\(/);
      expect(styleSource).not.toMatch(/backdrop-filter\s*:/);
      expect(styleSource).not.toMatch(/mask-image\s*:/);
      expect(styleSource).not.toMatch(/--shadow-glow/);
    }
  });
});
