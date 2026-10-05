import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const portfolioStyles = readFileSync(path.join(process.cwd(), "src", "styles", "portfolio.css"), "utf8");
const layoutStyles = readFileSync(path.join(process.cwd(), "src", "styles", "layout.css"), "utf8");

describe("profile overview responsive styles", () => {
  it("keeps the desktop shell unchanged while adding a bounded intermediate layout", () => {
    const shellRule = portfolioStyles.match(/\.profile-overview__shell\s*\{[^}]*}/s)?.[0] ?? "";
    const mobileUiStyles = portfolioStyles.match(
      /@media \(max-width: 980px\)\s*\{[\s\S]*?(?=@media \(min-width: 721px\) and \(max-width: 980px\))/
    )?.[0] ?? "";
    const intermediateStyles = portfolioStyles.match(
      /@media \(min-width: 721px\) and \(max-width: 980px\)\s*\{[\s\S]*?(?=@media \(min-width: 721px\) and \(max-width: 860px\))/
    )?.[0] ?? "";

    expect(shellRule).toMatch(/grid-template-areas:\s*"profile introduction"\s*"profile details"/);
    expect(shellRule).toMatch(/grid-template-columns:\s*minmax\(240px, 320px\) minmax\(0, 1fr\)/);
    expect(mobileUiStyles).toMatch(
      /\.profile-overview__shell\s*\{[^}]*grid-template-areas:\s*"profile"\s*"introduction"\s*"details"/
    );
    expect(intermediateStyles).toMatch(
      /\.profile-overview__shell\s*\{[^}]*grid-template-areas:\s*"introduction"\s*"profile"\s*"details"[^}]*row-gap:\s*var\(--space-6\)/
    );
    expect(intermediateStyles).toMatch(
      /\.profile-overview__photo-column\s*\{[^}]*grid-template-columns:\s*minmax\(160px, 0\.8fr\) minmax\(280px, 1\.2fr\)[^}]*gap:\s*var\(--space-6\)[^}]*margin-bottom:\s*0/
    );
    expect(intermediateStyles).toMatch(/\.portrait-frame\s*\{[^}]*width:\s*clamp\(150px, 20vw, 184px\)/);
    expect(intermediateStyles).toMatch(/\.profile-overview__details\s*\{[^}]*gap:\s*var\(--space-6\)/);
  });

  it("keeps the intermediate contact row safely wrap-ready and preserves its no-contact fallback", () => {
    const intermediateStyles = portfolioStyles.match(
      /@media \(min-width: 721px\) and \(max-width: 980px\)\s*\{[\s\S]*?(?=@media \(min-width: 721px\) and \(max-width: 860px\))/
    )?.[0] ?? "";

    expect(intermediateStyles).toMatch(
      /\.profile-overview__photo-column\[data-has-identity-items="false"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*justify-items:\s*center/
    );
    expect(intermediateStyles).toMatch(
      /\.profile-overview__identity-list\s*\{[^}]*grid-column:\s*2[^}]*width:\s*100%[^}]*border-inline-start:\s*1px solid var\(--color-line\)/
    );
    expect(intermediateStyles).toMatch(
      /\.profile-overview__identity-link,\s*\.profile-overview__identity-static\s*\{[^}]*min-height:\s*44px/
    );
  });

  it("puts the intro first and keeps the phone profile/contact block in two safe columns", () => {
    const phoneStyles = portfolioStyles.match(
      /@media \(max-width: 720px\)\s*\{[\s\S]*?(?=@media \(max-width: 620px\))/
    )?.[0] ?? "";

    expect(phoneStyles).toMatch(
      /\.profile-overview__shell\s*\{[^}]*grid-template-areas:\s*"introduction"\s*"profile"\s*"details"/
    );
    expect(phoneStyles).toMatch(
      /\.profile-overview__photo-column\s*\{[^}]*grid-template-columns:\s*minmax\(96px, 0\.82fr\) minmax\(0, 1\.18fr\)[^}]*width:\s*100%/
    );
    expect(phoneStyles).toMatch(
      /\.profile-overview__photo-column\[data-has-identity-items="false"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*justify-items:\s*center/
    );
    expect(phoneStyles).toMatch(
      /\.profile-overview__identity-list\s*\{[^}]*width:\s*100%[^}]*border-top:\s*0[^}]*border-inline-start:\s*1px solid var\(--color-line\)/
    );
    expect(phoneStyles).toMatch(/\.portrait-frame\s*\{[^}]*width:\s*clamp\(96px, 28vw, 132px\)/);
  });

  it("allows identity labels to wrap and retains mobile-size contact rows", () => {
    expect(portfolioStyles).toMatch(
      /\.profile-overview__identity-link > span\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/
    );
    expect(portfolioStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.profile-overview__identity-link,\s*\.profile-overview__identity-static\s*\{[^}]*min-height:\s*44px/
    );
    expect(portfolioStyles).not.toMatch(/\.profile-overview__(?:shell|introduction|photo-column|details)\s*\{[^}]*display:\s*contents/);
  });

  it("applies compact Home density only through the 860px boundary", () => {
    const compactStyles = portfolioStyles.match(
      /@media \(min-width: 721px\) and \(max-width: 860px\)\s*\{[\s\S]*?(?=@media \(max-width: 720px\))/
    )?.[0] ?? "";

    expect(compactStyles).toMatch(
      /\.home-experience-group,\s*\.home-education-item\s*\{[^}]*gap:\s*var\(--space-3\)[^}]*padding-block:\s*var\(--space-4\)/
    );
    expect(compactStyles).toMatch(/\.home-card-summary__full\s*\{[^}]*display:\s*none/);
    expect(compactStyles).toMatch(/\.home-card-summary__mobile\s*\{[^}]*display:\s*inline/);
    expect(compactStyles).toMatch(/\.home-project-card__skills\s*\{[^}]*display:\s*none/);
    expect(compactStyles).toMatch(
      /\.home-section__surface \.glass-card\s*\{[^}]*gap:\s*var\(--space-4\)[^}]*padding:\s*20px/
    );
    expect(compactStyles).toMatch(
      /\.featured-grid,\s*\.skills-cloud--compact,\s*\.home-recommendations,\s*\.home-recommendations__grid\s*\{[^}]*gap:\s*var\(--space-4\)/
    );
    expect(layoutStyles).toMatch(
      /@media \(min-width: 721px\) and \(max-width: 860px\)\s*\{[\s\S]*?\.home-section__surface\s*\{[^}]*padding:\s*20px/
    );
  });
});
