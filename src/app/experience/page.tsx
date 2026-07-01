import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { ExperienceTimeline } from "@/components/portfolio/ExperienceTimeline";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectExperienceDetailContent } from "@/lib/content/selectHomeContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), "Experience", "Professional, research, teaching, and leadership experience with detailed context.");
}

export default function ExperiencePage() {
  const content = getPortfolioContent();
  const experienceItems = selectExperienceDetailContent(content);

  return (
    <PageContainer
      eyebrow="Experience"
      title="Experience"
      description="Professional, research, teaching, and leadership work with concise context and supporting details."
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ExperienceTimeline items={experienceItems} variant="detail" />
    </PageContainer>
  );
}
