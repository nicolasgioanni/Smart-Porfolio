import type { ReactNode } from "react";
import type { GeneratedPortfolioContent } from "@/content/types";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

type SiteShellProps = {
  children: ReactNode;
  content: GeneratedPortfolioContent;
};

export function SiteShell({ children, content }: SiteShellProps) {
  return (
    <div className="site-shell" data-glass-effects={content.siteSettings.enableGlassEffects ? "true" : "false"}>
      <SiteHeader content={content} />
      <main className="site-main">{children}</main>
      <SiteFooter content={content} />
    </div>
  );
}
