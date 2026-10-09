import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectStyles = readFileSync(path.join(process.cwd(), "src", "features", "projects", "projects.css"), "utf8");

describe("Project showcase style contracts", () => {
  it("keeps the switcher footprint, contained 3D faces, centered fixed toggle, and static fallback in feature-owned styles", () => {
    expect(projectStyles).toMatch(/\.project-visual-switcher__viewport[\s\S]*?aspect-ratio:\s*16\s*\/\s*10/);
    expect(projectStyles).toMatch(/\.project-visual-switcher__image\s*\{[^}]*object-fit:\s*contain/s);
    expect(projectStyles).toMatch(/\.project-visual-switcher__scene\s*\{[^}]*perspective:\s*1200px/s);
    expect(projectStyles).toMatch(/\.project-visual-switcher__track\s*\{[^}]*transform-style:\s*preserve-3d[^}]*transition:\s*transform\s+520ms/s);
    expect(projectStyles).toMatch(/\.project-visual-switcher__track\[data-view="workflow"\]\s*\{\s*transform:\s*rotateY\(-180deg\)/s);
    expect(projectStyles).toMatch(/\.project-visual-switcher__panel\s*\{[^}]*overflow:\s*hidden[^}]*backface-visibility:\s*hidden/s);
    expect(projectStyles).toMatch(/\.project-visual-switcher__controls\s*\{[^}]*justify-content:\s*center/s);
    expect(projectStyles).toMatch(/\.project-visual-switcher__toggle\s*\{[^}]*flex:\s*0\s+0\s+auto[^}]*min-height:\s*44px/s);
    expect(projectStyles).toMatch(/\.project-visual-switcher__toggle-label\s*\{[^}]*opacity:\s*0[^}]*transition:\s*opacity\s+180ms/s);
    expect(projectStyles).toMatch(/\.project-visual-switcher__media:hover\s*\{\s*transform:\s*translateY\(-3px\)/s);
    expect(projectStyles).toMatch(/\.project-visual-static \.project-visual-switcher__media-link:focus-visible::after\s*\{[^}]*inset:\s*2px[^}]*box-shadow:/s);
    expect(projectStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration:\s*0ms/s);
    expect(projectStyles).toMatch(/\.project-visual-static__details[\s\S]*?\.project-diagram[\s\S]*?aspect-ratio:\s*16\s*\/\s*10/s);
  });
});
