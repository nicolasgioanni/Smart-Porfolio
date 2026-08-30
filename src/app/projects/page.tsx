import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { ProjectList } from "@/components/portfolio/ProjectList";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectProjectDetailContent } from "@/lib/content/selectHomeContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.projects,
    title: "Projects",
    description: "Engineering projects with problem framing, decisions, stack, links, and impact."
  });
}

export default function ProjectsPage() {
  const content = getPortfolioContent();
  const projectItems = selectProjectDetailContent(content);

  return (
    <PageContainer
      title="Projects"
      description="I build practical tools for learning, file organization, and developer automation—explore the projects below."
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ProjectList items={projectItems} variant="detail" />
    </PageContainer>
  );
}
