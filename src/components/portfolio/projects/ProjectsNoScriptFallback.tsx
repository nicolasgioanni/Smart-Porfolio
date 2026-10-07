import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectList } from "@/components/portfolio/projects/ProjectList";
import type { ProjectItem } from "@/content/types";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";
import { siteRoutes } from "@/lib/routing/siteRoutes";

type ProjectsNoScriptFallbackProps = {
  items: ProjectItem[];
};

export function ProjectsNoScriptFallback({ items }: ProjectsNoScriptFallbackProps) {
  const header = routeHeaderContent[siteRoutes.projects];

  return (
    <PageContainer description={header.description} introVariant="panel" motionEnabled={false} title={header.title}>
      <ProjectList items={items} staticVisual variant="detail" />
    </PageContainer>
  );
}
