import { describe, expect, it } from "vitest";
import { experienceSkeletonProfiles } from "@/components/loading/ExperiencePageSkeleton";
import { projectSkeletonProfiles } from "@/components/loading/projectSkeletonProfiles";
import { researchSkeletonProfiles } from "@/components/loading/ResearchPageSkeleton";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { getExperienceModeContent } from "@/lib/content/experienceNarratives";
import { getResearchFormalTitle, getResearchModeContent } from "@/lib/content/researchNarratives";
import { getProfileIdentityItems } from "@/lib/content/profileOverview";
import { resolveRouteHeaderContent, routeHeaderContent } from "@/lib/content/routeHeaderContent";
import { siteRoutePaths, siteRoutes } from "@/components/navigation/siteRoutes";
import {
  selectExperienceDetailContent,
  selectProjectDetailContent,
  selectResearchDetailContent
} from "@/lib/content/selectHomeContent";

describe("skeleton source contracts", () => {
  const content = getPortfolioContent();

  it("keeps canonical route header copy exhaustive and resolves the validated Experience summary override or fallback", () => {
    expect(Object.keys(routeHeaderContent)).toEqual(siteRoutePaths);
    expect(routeHeaderContent[siteRoutes.home]).toBeNull();
    const experienceFallback = routeHeaderContent[siteRoutes.experience];

    expect(experienceFallback).not.toBeNull();
    expect(resolveRouteHeaderContent(siteRoutes.experience, content)?.description).toBe(
      content.profile.experienceSummary ?? experienceFallback?.description
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

  it("keeps literal project loader profiles in the published detail order without importing content at runtime", () => {
    const projects = selectProjectDetailContent(content);

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

  it("keeps the five Experience card silhouettes aligned with their published overview rows", () => {
    const experience = selectExperienceDetailContent(content);

    expect(experience).toHaveLength(5);
    expect(experienceSkeletonProfiles.map((profile) => profile.id)).toEqual(experience.map((item) => item.id));
    expect(experienceSkeletonProfiles.map((profile) => profile.overviewRows)).toEqual(
      experience.map((item) => getExperienceModeContent(item, "overview").sections.length)
    );
  });

  it("matches the visible Home identity rows and organization-group role silhouettes", () => {
    const identityItems = getProfileIdentityItems(content.profile, content.links);
    const organizationCounts = Array.from(
      content.experience.reduce((groups, item) => {
        const key = item.organization.trim().toLowerCase();
        groups.set(key, (groups.get(key) ?? 0) + 1);
        return groups;
      }, new Map<string, number>()).values()
    );

    expect(identityItems.map((item) => item.id)).toEqual(["location", "timezone", "email", "linkedin", "github"]);
    expect(organizationCounts).toEqual([1, 2, 2]);
  });

  it("matches research media, identity, overview, and canonical visible resource footprints without loading dialog content", () => {
    const research = selectResearchDetailContent(content);

    expect(research.map((item) => item.id)).toEqual([
      "cytocv-miller-lab",
      "adversarial-machine-learning",
      "yeast-dna-target-selection"
    ]);
    expect(researchSkeletonProfiles.map((profile) => profile.id)).toEqual(research.map((item) => item.id));
    expect(researchSkeletonProfiles.map((profile) => profile.media)).toEqual(["video-and-abstract", "abstract", "abstract"]);
    expect(researchSkeletonProfiles.map((profile) => profile.formalTitle)).toEqual(
      research.map((item) => Boolean(getResearchFormalTitle(item)))
    );
    expect(researchSkeletonProfiles.map((profile) => profile.resourceWidths.length)).toEqual([4, 3, 1]);
    expect(research.map((item) => item.links.length + (item.pendingLinks?.length ?? 0))).toEqual([4, 3, 1]);
    expect(researchSkeletonProfiles.every((profile) => profile.organizationLogo && profile.impact)).toBe(true);
    expect(researchSkeletonProfiles.map((profile) => profile.overviewRows)).toEqual(
      research.map((item) => getResearchModeContent(item, "overview").sections.length)
    );
  });
});
