import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
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

  return (
    <PageContainer
      className="page-container--experience"
      title="Experience"
      description="A closer look at what I built, how I worked, and what changed—available in plain language or technical detail."
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ExperienceShowcase items={experienceItems} motionEnabled={content.siteSettings.enableScrollMotion} />
    </PageContainer>
  );
}
