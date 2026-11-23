import { readFileSync } from "node:fs";
import type { GeneratedPortfolioContent } from "../../src/content/types";
import { validatePortfolioContent } from "../../src/lib/content/validatePortfolioContent";

const generatedContentUrl = new URL("../../src/content/generated/portfolio.generated.json", import.meta.url);

/** Reads the exact generated snapshot that the Playwright-owned Next server renders. */
export function readGeneratedPortfolioContent(): GeneratedPortfolioContent {
  const content = JSON.parse(readFileSync(generatedContentUrl, "utf8")) as GeneratedPortfolioContent;

  return validatePortfolioContent(content);
}
