import type { GeneratedPortfolioContent, ResearchItem } from "@/content/types";
import { sortForDetail } from "@/lib/content/sortPortfolioContent";

export function selectResearchDetailContent(content: GeneratedPortfolioContent): ResearchItem[] {
  return sortForDetail(content.research);
}
