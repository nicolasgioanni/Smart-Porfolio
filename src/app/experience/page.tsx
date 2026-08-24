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
      title="Experience"
      description="My experience spans AI engineering, full-stack research software, and computer science teaching—see the roles below."
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ExperienceTimeline items={experienceItems} variant="detail" />
    </PageContainer>
  );
}
