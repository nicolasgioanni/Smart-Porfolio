import type {
  EducationItem,
  ExperienceItem,
  GeneratedPortfolioContent,
  HomePortfolioContent,
  PortfolioLink,
  ProjectItem,
  ResearchItem,
  SkillGroup,
  SkillItem
} from "@/content/types";
import { limitItems } from "@/lib/content/displayHelpers";
import { createProfileOverviewContent } from "@/lib/content/profileOverview";
import { selectHomeRecommendations } from "@/lib/content/selectRecommendationContent";
import { resolveItemLimit, selectHomeCandidates } from "@/lib/content/selectVisibleContent";
import { sortForHome, sortGeneric } from "@/lib/content/sortPortfolioContent";

type HomeSelectableItem = EducationItem | ExperienceItem | ProjectItem | ResearchItem;

export function selectHomeItems<TItem extends HomeSelectableItem>(items: TItem[], maxItems?: number): TItem[] {
  const sortedItems = sortForHome(selectHomeCandidates(items));

  return limitItems(sortedItems, resolveItemLimit(maxItems, sortedItems.length));
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
  const sortedSkills = sortGeneric(selectHomeCandidates(skills));

  return limitItems(sortedSkills, resolveItemLimit(maxItems, sortedSkills.length));
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
