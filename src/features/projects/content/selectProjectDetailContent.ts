import type { GeneratedPortfolioContent, ProjectItem } from "@/content/types";
import { sortForDetail } from "@/lib/content/sortPortfolioContent";

export function selectProjectDetailContent(content: GeneratedPortfolioContent): ProjectItem[] {
  return sortForDetail(content.projects);
}
