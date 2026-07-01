import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectList } from "@/components/portfolio/ProjectList";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectProjectDetailContent } from "@/lib/content/selectHomeContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), "Projects", "Engineering projects with problem framing, decisions, stack, links, and impact.");
}

export default function ProjectsPage() {
  const content = getPortfolioContent();
  const projectItems = selectProjectDetailContent(content);

  return (
    <PageContainer
      eyebrow="Projects"
      title="Engineering projects"
      description="Selected builds with problem framing, decisions, impact, stack, and links."
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ProjectList items={projectItems} variant="detail" />
    </PageContainer>
  );
}
