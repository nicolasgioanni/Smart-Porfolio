import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { ResumeSummary } from "@/components/portfolio/ResumeSummary";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import {
  groupSkillsByCategory,
  selectEducationDetailContent,
  selectExperienceDetailContent,
  selectProjectDetailContent,
  selectResearchDetailContent
} from "@/lib/content/selectHomeContent";
import { sortGeneric } from "@/lib/content/sortPortfolioContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), "Resume", "Resume with experience, research, projects, education, and skills.");
}

export default function ResumePage() {
  const content = getPortfolioContent();

  return (
    <PageContainer
      title="Resume"
      description="See my experience, research, projects, education, and technical skills below, or open the full PDF."
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ResumeSummary
        education={selectEducationDetailContent(content)}
        experience={selectExperienceDetailContent(content)}
        profile={content.profile}
        projects={selectProjectDetailContent(content)}
        research={selectResearchDetailContent(content)}
        resume={sortGeneric(content.resume)}
        skillGroups={groupSkillsByCategory(content.skills)}
      />
    </PageContainer>
  );
}
