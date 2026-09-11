import type { ExperienceItem, GeneratedPortfolioContent, PortfolioLink, ProfileContent, ProjectItem } from "@/content/types";
import { describe, expect, it } from "vitest";
import { experienceSkeletonProfiles } from "@/components/loading/ExperiencePageSkeleton";
import { projectSkeletonProfiles } from "@/components/loading/projectSkeletonProfiles";
import { researchSkeletonProfiles } from "@/components/loading/ResearchPageSkeleton";
import { getExperienceModeContent } from "@/lib/content/experienceNarratives";
import { getResearchFormalTitle, getResearchModeContent, getResearchVisibleResources } from "@/lib/content/researchNarratives";
import { getProfileIdentityItems } from "@/lib/content/profileOverview";
import { resolveRouteHeaderContent, routeHeaderContent } from "@/lib/content/routeHeaderContent";
import { siteRoutePaths, siteRoutes } from "@/components/navigation/siteRoutes";
import {
  selectExperienceDetailContent,
  selectProjectDetailContent,
  selectResearchDetailContent
} from "@/lib/content/selectHomeContent";
import { researchSkeletonFixtures } from "../../../tests/fixtures/researchSkeletonContent";

const projectContentFixture: ProjectItem[] = [
  {
    id: "notepal",
    title: "NotePal",
    homeSkills: [],
    stack: Array.from({ length: 10 }, (_, index) => `NotePal skill ${index + 1}`),
    links: [
      { label: "Live site", url: "https://example.com/notepal" },
      { label: "Source code", url: "https://example.com/notepal-source" }
    ],
    problem: "A clear problem.",
    solution: "A clear solution.",
    featured: true,
    showOnHome: true,
    detailOrder: 1
  },
  {
    id: "clair",
    title: "Clair",
    homeSkills: [],
    stack: Array.from({ length: 6 }, (_, index) => `Clair skill ${index + 1}`),
    links: [{ label: "Source code", url: "https://example.com/clair-source" }],
    problem: "A clear problem.",
    solution: "A clear solution.",
    featured: true,
    showOnHome: true,
    detailOrder: 2
  },
  {
    id: "leetnotes",
    title: "LeetNotes",
    homeSkills: [],
    stack: Array.from({ length: 5 }, (_, index) => `LeetNotes skill ${index + 1}`),
    links: [{ label: "Source code", url: "https://example.com/leetnotes-source" }],
    problem: "A clear problem.",
    solution: "A clear solution.",
    featured: true,
    showOnHome: true,
    detailOrder: 3
  }
];

const experienceContentFixture: ExperienceItem[] = [
  "us-treasury-ai-engineer",
  "research-assistant-software-engineering",
  "teaching-assistant",
  "undergraduate-researcher-adversarial-ml",
  "research-assistant-ai-ml"
].map((id, index) => ({
  id,
  title: `Experience ${index + 1}`,
  organization: index === 0 ? "Treasury" : index < 3 ? "University" : "Research lab",
  bullets: [],
  skills: [],
  featured: true,
  showOnHome: true,
  detailOrder: index + 1
}));

const profileContentFixture: ProfileContent = {
  fullName: "Fixture Person",
  headline: "Fixture engineer",
  location: "Fixture City",
  timezone: "America/Los_Angeles",
  email: "fixture@example.com",
  shortBio: "Fixture profile."
};

const profileLinksFixture: PortfolioLink[] = [
  {
    id: "email",
    label: "Email",
    url: "mailto:fixture@example.com",
    kind: "email",
    isPrimary: true,
    showOnHome: true,
    showInHeader: true,
    showInFooter: true
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/fixture",
    kind: "linkedin",
    isPrimary: true,
    showOnHome: true,
    showInHeader: true,
    showInFooter: true
  },
  {
    id: "github",
    label: "GitHub",
    url: "https://github.com/fixture",
    kind: "github",
    isPrimary: true,
    showOnHome: true,
    showInHeader: true,
    showInFooter: true
  }
];

describe("skeleton source contracts", () => {
  it("keeps canonical route header copy exhaustive and resolves the validated Experience summary override or fallback", () => {
    expect(Object.keys(routeHeaderContent)).toEqual(siteRoutePaths);
    expect(routeHeaderContent[siteRoutes.home]).toBeNull();
    const experienceFallback = routeHeaderContent[siteRoutes.experience];
    const generatedSummary = "A valid Experience summary from supported generated content.";

    expect(experienceFallback).not.toBeNull();
    expect(resolveRouteHeaderContent(siteRoutes.experience, { profile: { experienceSummary: generatedSummary } })?.description).toBe(
      generatedSummary
    );
    expect(resolveRouteHeaderContent(siteRoutes.experience)?.description).toBe(experienceFallback?.description);
    expect(resolveRouteHeaderContent(siteRoutes.experience, { profile: { experienceSummary: undefined } })?.description).toBe(
      experienceFallback?.description
    );
    expect(resolveRouteHeaderContent(siteRoutes.experience, { profile: { experienceSummary: "" } })?.description).toBe("");
    expect(
      resolveRouteHeaderContent(siteRoutes.experience, {
        profile: { experienceSummary: "A different valid summary from generated content." }
      })?.description
    ).toBe("A different valid summary from generated content.");
    expect(routeHeaderContent[siteRoutes.research]).toMatchObject({
      accessory: "detail-level",
      placement: "embedded",
      title: "Applied AI Research"
    });
    expect(siteRoutePaths.slice(1).every((pathname) => Boolean(routeHeaderContent[pathname]?.description))).toBe(true);
  });

  it("keeps literal project loader profiles in the fixture detail order without ambient generated content", () => {
    const projects = selectProjectDetailContent({ projects: projectContentFixture } as GeneratedPortfolioContent);

    expect(projects.map((project) => project.id)).toEqual(["notepal", "clair", "leetnotes"]);
    expect(projectSkeletonProfiles.map((profile) => profile.id)).toEqual(projects.map((project) => project.id));
    expect(projectSkeletonProfiles.map((profile) => profile.chipWidths.length)).toEqual([10, 6, 5]);
    expect(projectSkeletonProfiles.map((profile) => profile.actionWidths.length)).toEqual([2, 1, 1]);
    expect(projectSkeletonProfiles.map((profile) => profile.deepDiveLines)).toEqual([
      [[100, 84], [100, 88]],
      [[100, 86], [100, 84]],
      [[100, 86], [100, 90]]
    ]);
    expect(projects.map((project) => project.stack.length)).toEqual([10, 6, 5]);
    expect(projects.every((project) => Boolean(project.problem) && Boolean(project.solution))).toBe(true);
    expect(projects.every((project) => !project.impact)).toBe(true);
    expect(projects.map((project) => project.links.length)).toEqual([2, 1, 1]);
  });

  it("keeps the five Experience card silhouettes aligned with fixture overview rows", () => {
    const experience = selectExperienceDetailContent({ experience: experienceContentFixture } as GeneratedPortfolioContent);

    expect(experience).toHaveLength(5);
    expect(experienceSkeletonProfiles.map((profile) => profile.id)).toEqual(experience.map((item) => item.id));
    expect(experienceSkeletonProfiles.map((profile) => profile.overviewRows)).toEqual(
      experience.map((item) => getExperienceModeContent(item, "overview").sections.length)
    );
  });

  it("matches the visible Home identity rows and organization-group role silhouettes from fixture content", () => {
    const identityItems = getProfileIdentityItems(profileContentFixture, profileLinksFixture);
    const organizationCounts = Array.from(
      experienceContentFixture.reduce((groups, item) => {
        const key = item.organization.trim().toLowerCase();
        groups.set(key, (groups.get(key) ?? 0) + 1);
        return groups;
      }, new Map<string, number>()).values()
    );

    expect(identityItems.map((item) => item.id)).toEqual(["location", "timezone", "email", "linkedin", "github"]);
    expect(organizationCounts).toEqual([1, 2, 2]);
  });

  it("keeps research card geometry literal while resolving supported resource fixtures", () => {
    expect(researchSkeletonProfiles.map((profile) => profile.id)).toEqual([
      "cytocv-miller-lab",
      "adversarial-machine-learning",
      "yeast-dna-target-selection"
    ]);
    expect(researchSkeletonProfiles.map((profile) => profile.media)).toEqual(["video-and-abstract", "abstract", "abstract"]);
    expect(researchSkeletonProfiles.map((profile) => profile.resourceWidths.length)).toEqual([4, 3, 1]);
    expect(researchSkeletonProfiles.every((profile) => profile.organizationLogo && profile.impact)).toBe(true);

    for (const { items, resourceCounts } of researchSkeletonFixtures) {
      const research = selectResearchDetailContent({ research: [...items] } as GeneratedPortfolioContent);
      const resolvedResourceCounts = research.map((item) => {
        const resources = getResearchVisibleResources(item);

        return resources.links.length + resources.pendingLinks.length;
      });

      expect(researchSkeletonProfiles.map((profile) => profile.id)).toEqual(research.map((item) => item.id));
      expect(researchSkeletonProfiles.map((profile) => profile.formalTitle)).toEqual(
        research.map((item) => Boolean(getResearchFormalTitle(item)))
      );
      expect(resolvedResourceCounts).toEqual(resourceCounts);
      expect(researchSkeletonProfiles.map((profile) => profile.overviewRows)).toEqual(
        research.map((item) => getResearchModeContent(item, "overview").sections.length)
      );
    }
  });
});
