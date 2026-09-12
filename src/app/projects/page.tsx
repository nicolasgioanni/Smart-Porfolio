import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import { ProjectList } from "@/components/portfolio/projects/ProjectList";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";
import { selectProjectDetailContent } from "@/lib/content/selectDetailContent";

const projectsHeader = routeHeaderContent[siteRoutes.projects];

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.projects,
    title: projectsHeader.title,
    description: "Engineering projects with problem framing, decisions, stack, links, and impact."
  });
}

export default function ProjectsPage() {
  const content = getPortfolioContent();
  const projectItems = selectProjectDetailContent(content);

  return (
    <PageContainer
      title={projectsHeader.title}
      description={projectsHeader.description}
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ProjectList items={projectItems} variant="detail" />
    </PageContainer>
  );
}
