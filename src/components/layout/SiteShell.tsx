import type { ReactNode } from "react";
import type { GeneratedPortfolioContent } from "@/content/types";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StaticPortfolioRouteGate } from "@/components/layout/StaticPortfolioRouteGate";
import { HomeOverview } from "@/components/portfolio/home/HomeOverview";
import { ProjectsNoScriptFallback } from "@/components/portfolio/projects/ProjectsNoScriptFallback";
import { selectProjectDetailContent } from "@/lib/content/selectDetailContent";
import { selectHomeContent } from "@/lib/content/selectHomeContent";
import type { ThemeName } from "@/lib/theme/resolveThemeName";

type SiteShellProps = {
  children: ReactNode;
  content: GeneratedPortfolioContent;
  initialTheme: ThemeName;
  researchFallback: ReactNode;
};

export function SiteShell({ children, content, initialTheme, researchFallback }: SiteShellProps) {
  const projectsFallback = <ProjectsNoScriptFallback items={selectProjectDetailContent(content)} />;
  const homeContent = selectHomeContent(content);
  const homeFallback = (
    <HomeOverview
      content={{ ...homeContent, siteSettings: { ...homeContent.siteSettings, enableScrollMotion: false } }}
    />
  );

  return (
    <div className="site-shell" data-glass-effects={content.siteSettings.enableGlassEffects ? "true" : "false"}>
      <SiteHeader content={content} initialTheme={initialTheme} />
      <main className="site-main">
        <StaticPortfolioRouteGate homeFallback={homeFallback} projectsFallback={projectsFallback} researchFallback={researchFallback}>
          {children}
        </StaticPortfolioRouteGate>
      </main>
      <SiteFooter content={content} />
    </div>
  );
}
