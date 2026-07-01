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
      eyebrow="Resume"
      title="Resume"
      description="Experience, research, projects, education, skills, and resume file access in one place."
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
