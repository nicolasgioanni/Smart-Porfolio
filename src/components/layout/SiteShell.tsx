import type { ReactNode } from "react";
import type { GeneratedPortfolioContent } from "@/content/types";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ResearchNoScriptRouteGate } from "@/components/layout/ResearchNoScriptRouteGate";
import { ResearchShowcase } from "@/components/portfolio/research/ResearchShowcase";
import { selectResearchDetailContent } from "@/lib/content/selectDetailContent";
import type { ThemeName } from "@/lib/theme/resolveThemeName";

type SiteShellProps = {
  children: ReactNode;
  content: GeneratedPortfolioContent;
  initialTheme: ThemeName;
};

export function SiteShell({ children, content, initialTheme }: SiteShellProps) {
  const researchFallback = <ResearchShowcase items={selectResearchDetailContent(content)} motionEnabled={false} />;

  return (
    <div className="site-shell" data-glass-effects={content.siteSettings.enableGlassEffects ? "true" : "false"}>
      <SiteHeader content={content} initialTheme={initialTheme} />
      <main className="site-main">
        <ResearchNoScriptRouteGate fallback={researchFallback}>{children}</ResearchNoScriptRouteGate>
      </main>
      <SiteFooter content={content} />
    </div>
  );
}
