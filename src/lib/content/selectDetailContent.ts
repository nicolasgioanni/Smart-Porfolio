import type { EducationItem, ExperienceItem, GeneratedPortfolioContent, ProjectItem, ResearchItem } from "@/content/types";
import { sortForDetail } from "@/lib/content/sortPortfolioContent";

export function selectResearchDetailContent(content: GeneratedPortfolioContent): ResearchItem[] {
  return sortForDetail(content.research);
}

export function selectProjectDetailContent(content: GeneratedPortfolioContent): ProjectItem[] {
  return sortForDetail(content.projects);
}

export function selectExperienceDetailContent(content: GeneratedPortfolioContent): ExperienceItem[] {
  return sortForDetail(content.experience);
}

export function selectEducationDetailContent(content: GeneratedPortfolioContent): EducationItem[] {
  return sortForDetail(content.education);
}
