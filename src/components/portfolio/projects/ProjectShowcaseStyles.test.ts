import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const portfolioStyles = readFileSync(path.join(process.cwd(), "src", "styles", "portfolio.css"), "utf8");

describe("Project showcase style contracts", () => {
  it("keeps unknown-project image fallbacks aligned with the showcase media frame", () => {
    expect(portfolioStyles).toMatch(
      /\.project-card--showcase \.project-card__image\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*10/s
    );
    expect(portfolioStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.project-card--showcase \.project-card__image\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s
    );
  });
});
