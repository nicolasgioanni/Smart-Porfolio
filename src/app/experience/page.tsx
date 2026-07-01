import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { ExperienceTimeline } from "@/components/portfolio/ExperienceTimeline";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectExperienceDetailContent } from "@/lib/content/selectHomeContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), "Experience", "Professional, research, teaching, and internship experience with detailed evidence.");
}

export default function ExperiencePage() {
  const content = getPortfolioContent();
  const experienceItems = selectExperienceDetailContent(content);

  return (
    <PageContainer
      eyebrow="Experience"
      title="Experience timeline"
      description="Professional, research, teaching, and leadership experience with full bullets and supporting context."
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ExperienceTimeline items={experienceItems} variant="detail" />
    </PageContainer>
  );
}
