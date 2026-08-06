import type { ReactNode } from "react";
import type { GeneratedPortfolioContent } from "@/content/types";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { ThemeName } from "@/lib/theme/resolveThemeName";

type SiteShellProps = {
  children: ReactNode;
  content: GeneratedPortfolioContent;
  initialTheme: ThemeName;
};

export function SiteShell({ children, content, initialTheme }: SiteShellProps) {
  return (
    <div className="site-shell" data-glass-effects={content.siteSettings.enableGlassEffects ? "true" : "false"}>
      <SiteHeader content={content} initialTheme={initialTheme} />
      <main className="site-main">{children}</main>
      <SiteFooter content={content} />
    </div>
  );
}
