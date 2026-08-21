import type {
  EducationItem,
  ExperienceItem,
  GeneratedPortfolioContent,
  HomePortfolioContent,
  PortfolioLink,
  ProjectItem,
  RecommendationItem,
  ResearchItem,
  SkillGroup,
  SkillItem
} from "@/content/types";
import { createProfileOverviewContent } from "@/lib/content/profileOverview";
import { sortForDetail, sortForHome, sortGeneric, sortRecommendationsForDetail, sortRecommendationsForHome } from "@/lib/content/sortPortfolioContent";

type HomeSelectableItem = ResearchItem | ProjectItem | ExperienceItem | EducationItem;

function safeMaxItems(maxItems: number | undefined, fallback: number): number {
  return maxItems && maxItems > 0 ? maxItems : fallback;
}

export function selectHomeItems<TItem extends HomeSelectableItem>(items: TItem[], maxItems?: number): TItem[] {
  const showOnHomeItems = items.filter((item) => item.showOnHome);
  const featuredItems = items.filter((item) => item.featured);
  const candidateItems = showOnHomeItems.length > 0 ? showOnHomeItems : featuredItems.length > 0 ? featuredItems : items;
  const sortedItems = sortForHome(candidateItems);

  return sortedItems.slice(0, safeMaxItems(maxItems, sortedItems.length));
}

export function groupSkillsByCategory(skills: SkillItem[]): SkillGroup[] {
  const groups = new Map<string, SkillGroup>();

  for (const skill of skills) {
    const existingGroup = groups.get(skill.category) ?? {
      category: skill.category,
      order: skill.categoryOrder,
      skills: []
    };

    existingGroup.skills.push(skill);
    existingGroup.order ??= skill.categoryOrder;
    groups.set(skill.category, existingGroup);
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, skills: sortGeneric(group.skills) }))
    .sort((left, right) => {
      const orderDifference = (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER);
      return orderDifference || left.category.localeCompare(right.category);
    });
}

export function selectPrimaryLinks(links: PortfolioLink[]): PortfolioLink[] {
  const selectedLinks = links.filter((link) => link.isPrimary || link.showOnHome || link.showInHeader);
  const fallbackLinks = selectedLinks.length > 0 ? selectedLinks : links;

  return sortGeneric(fallbackLinks).slice(0, 6);
}

export function selectHeaderLinks(links: PortfolioLink[]): PortfolioLink[] {
  return sortGeneric(links.filter((link) => link.showInHeader)).slice(0, 4);
}

export function selectHomeSkills(skills: SkillItem[], maxItems?: number): SkillItem[] {
  const showOnHomeSkills = skills.filter((skill) => skill.showOnHome);
  const featuredSkills = skills.filter((skill) => skill.featured);
  const candidateSkills = showOnHomeSkills.length > 0 ? showOnHomeSkills : featuredSkills.length > 0 ? featuredSkills : skills;
  const sortedSkills = sortGeneric(candidateSkills);

  return sortedSkills.slice(0, safeMaxItems(maxItems, sortedSkills.length));
}

export function createRecommendationExcerpt(fullQuote: string, maxLength = 190): string {
  const normalizedQuote = fullQuote.trim().replace(/\s+/g, " ");

  if (normalizedQuote.length <= maxLength) {
    return normalizedQuote;
  }

  const truncatedQuote = normalizedQuote.slice(0, maxLength).trimEnd();
  const lastSpaceIndex = truncatedQuote.lastIndexOf(" ");
  const wordSafeQuote = lastSpaceIndex > 80 ? truncatedQuote.slice(0, lastSpaceIndex) : truncatedQuote;

  return `${wordSafeQuote.replace(/[.,;:!?]$/, "")}...`;
}

export function selectHomeRecommendations(recommendations: RecommendationItem[], maxItems?: number): RecommendationItem[] {
  const showOnHomeItems = recommendations.filter((item) => item.showOnHome);
  const featuredItems = recommendations.filter((item) => item.featured);
  const candidateItems = showOnHomeItems.length > 0 ? showOnHomeItems : featuredItems.length > 0 ? featuredItems : recommendations;
  const sortedItems = sortRecommendationsForHome(candidateItems);

  return sortedItems.slice(0, safeMaxItems(maxItems, 3));
}

export function getFeaturedRecommendation(recommendations: RecommendationItem[]): RecommendationItem | undefined {
  return sortRecommendationsForDetail(recommendations)[0];
}

export function hasRecommendations(recommendations: RecommendationItem[]): boolean {
  return recommendations.length > 0;
}

export function shouldShowRecommendationsRoute(content: Pick<GeneratedPortfolioContent, "recommendations" | "siteSettings">): boolean {
  return (
    content.siteSettings.enableRecommendations !== false &&
    (hasRecommendations(content.recommendations) || content.siteSettings.showEmptyRecommendations === true)
  );
}

export function selectHomeContent(content: GeneratedPortfolioContent): HomePortfolioContent {
  const profileOverview = createProfileOverviewContent(content);
  const homeSkills = selectHomeSkills(content.skills, content.siteSettings.maxHomeSkillItems);
  const recommendationsEnabled = content.siteSettings.enableRecommendations !== false;

  return {
    profile: content.profile,
    profileOverview,
    links: selectPrimaryLinks(content.links),
    research: selectHomeItems(content.research, content.siteSettings.maxHomeResearchItems),
    projects: selectHomeItems(content.projects, content.siteSettings.maxHomeProjectItems),
    experience: selectHomeItems(content.experience),
    recommendations: recommendationsEnabled ? selectHomeRecommendations(content.recommendations, content.siteSettings.maxHomeRecommendationItems) : [],
    education: selectHomeItems(content.education),
    skillGroups: groupSkillsByCategory(homeSkills),
    resume: sortGeneric(content.resume),
    siteSettings: content.siteSettings
  };
}

export function selectResearchDetailContent(content: GeneratedPortfolioContent): ResearchItem[] {
  return sortForDetail(content.research);
}

export function selectProjectDetailContent(content: GeneratedPortfolioContent): ProjectItem[] {
  return sortForDetail(content.projects);
}

export function selectExperienceDetailContent(content: GeneratedPortfolioContent): ExperienceItem[] {
  return sortForDetail(content.experience);
}

export function selectRecommendationDetailContent(content: GeneratedPortfolioContent): RecommendationItem[] {
  return content.siteSettings.enableRecommendations === false ? [] : sortRecommendationsForDetail(content.recommendations);
}

export function selectEducationDetailContent(content: GeneratedPortfolioContent): EducationItem[] {
  return sortForDetail(content.education);
}
