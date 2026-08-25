import type { Metadata } from "next";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { ExperienceShowcase } from "@/components/portfolio/ExperienceShowcase";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectExperienceDetailContent } from "@/lib/content/selectHomeContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.experience,
    title: "Experience",
    description: "Professional, research, teaching, and leadership experience with detailed context."
  });
}

export default function ExperiencePage() {
  const content = getPortfolioContent();
  const experienceItems = selectExperienceDetailContent(content);
  const experienceSummary =
    content.profile.experienceSummary ??
    "My experience spans AI engineering at the U.S. Treasury, research software and machine learning at the University of Washington, and teaching core computer science courses.";

  return (
    <ExperienceShowcase
      items={experienceItems}
      motionEnabled={content.siteSettings.enableScrollMotion}
      summary={experienceSummary}
    />
  );
}
