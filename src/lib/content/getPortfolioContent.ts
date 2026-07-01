import generatedPortfolioContent from "@/content/generated/portfolio.generated.json";
import type { GeneratedPortfolioContent } from "@/content/types";
import { validatePortfolioContent } from "@/lib/content/validatePortfolioContent";

export function getPortfolioContent(): GeneratedPortfolioContent {
  return validatePortfolioContent(generatedPortfolioContent as GeneratedPortfolioContent);
}
