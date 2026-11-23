import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import { ProjectsNoScriptFallback } from "@/features/projects/components/ProjectsNoScriptFallback";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectProjectDetailContent } from "@/features/projects/content/selectProjectDetailContent";

export default function ProjectsLayout({ children }: Readonly<{ children: ReactNode }>) {
  const content = getPortfolioContent();

  return (
    <RouteNoScriptFallback fallback={<ProjectsNoScriptFallback items={selectProjectDetailContent(content)} />}>
      {children}
    </RouteNoScriptFallback>
  );
}
