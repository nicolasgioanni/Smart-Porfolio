import type { ReactNode } from "react";
import type { GeneratedPortfolioContent } from "@/content/types";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StaticPortfolioRouteGate } from "@/components/layout/StaticPortfolioRouteGate";
import type { ThemeName } from "@/lib/theme/resolveThemeName";

type SiteShellProps = {
  children: ReactNode;
  content: GeneratedPortfolioContent;
  homeFallback: ReactNode;
  initialTheme: ThemeName;
  projectsFallback: ReactNode;
  researchFallback: ReactNode;
};

export function SiteShell({ children, content, homeFallback, initialTheme, projectsFallback, researchFallback }: SiteShellProps) {

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
