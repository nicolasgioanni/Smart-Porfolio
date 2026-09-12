import type { Metadata } from "next";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import { ExperienceShowcase } from "@/components/portfolio/experience/ExperienceShowcase";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { resolveRouteHeaderContent, routeHeaderContent } from "@/lib/content/routeHeaderContent";
import { selectExperienceDetailContent } from "@/lib/content/selectDetailContent";

const experienceHeader = routeHeaderContent[siteRoutes.experience];

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.experience,
    title: experienceHeader.title,
    description: "Professional, research, teaching, and leadership experience with detailed context."
  });
}

export default function ExperiencePage() {
  const content = getPortfolioContent();
  const experienceItems = selectExperienceDetailContent(content);
  const experienceSummary = resolveRouteHeaderContent(siteRoutes.experience, content)?.description ?? experienceHeader.description;

  return (
    <ExperienceShowcase
      items={experienceItems}
      motionEnabled={content.siteSettings.enableScrollMotion}
      summary={experienceSummary}
    />
  );
}
