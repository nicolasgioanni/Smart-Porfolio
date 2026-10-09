import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/glass.css";
import "@/styles/dialog.css";
import "@/styles/navigation.css";
import "@/styles/portfolio.css";
import "@/features/projects/projects.css";
import "@/styles/detail.css";
import "@/styles/experience.css";
import "@/features/research/research.css";
import "@/styles/motion.css";
import "@/styles/skeletons.css";
import "@/styles/contact.css";
import "@/styles/interactions.css";
import "@/styles/utilities.css";
import { SiteShell } from "@/components/layout/SiteShell";
import { HomeOverview } from "@/components/portfolio/home/HomeOverview";
import { HomeFeaturedProjects } from "@/features/projects/components/HomeFeaturedProjects";
import { ProjectsNoScriptFallback } from "@/features/projects/components/ProjectsNoScriptFallback";
import { ResearchShowcase } from "@/features/research/components/ResearchShowcase";
import { selectResearchDetailContent } from "@/features/research/content/selectResearchDetailContent";
import { selectProjectDetailContent } from "@/lib/content/selectDetailContent";
import { selectHomeContent } from "@/lib/content/selectHomeContent";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import { ThemePreferenceScript } from "@/components/theme/ThemePreferenceScript";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { SITE_LANGUAGE } from "@/lib/seo/siteConfig";
import { resolveThemeName } from "@/lib/theme/resolveThemeName";

const spaceGrotesk = Space_Grotesk({
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"]
});

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), { pathname: siteRoutes.home });
}

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = getPortfolioContent();
  const initialTheme = resolveThemeName(content.siteSettings.defaultTheme);
  const homeContent = selectHomeContent(content);
  const homeFallback = <HomeOverview content={{ ...homeContent, siteSettings: { ...homeContent.siteSettings, enableScrollMotion: false } }} projectHighlights={<HomeFeaturedProjects items={homeContent.projects} />} />;
  const projectsFallback = <ProjectsNoScriptFallback items={selectProjectDetailContent(content)} />;
  const researchFallback = <ResearchShowcase items={selectResearchDetailContent(content)} motionEnabled={false} />;

  return (
    <html lang={SITE_LANGUAGE} data-scroll-behavior="smooth" data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <ThemePreferenceScript initialTheme={initialTheme} />
      </head>
      <body className={`${spaceGrotesk.className} ${spaceGrotesk.variable}`}>
        <SiteShell content={content} homeFallback={homeFallback} initialTheme={initialTheme} projectsFallback={projectsFallback} researchFallback={researchFallback}>
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
