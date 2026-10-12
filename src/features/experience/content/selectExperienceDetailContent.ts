import type { GeneratedPortfolioContent, ExperienceItem } from "@/content/types";
import { sortForDetail } from "@/lib/content/sortPortfolioContent";

export function selectExperienceDetailContent(content: GeneratedPortfolioContent): ExperienceItem[] {
  return sortForDetail(content.experience);
}
