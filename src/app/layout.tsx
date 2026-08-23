import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/glass.css";
import "@/styles/navigation.css";
import "@/styles/portfolio.css";
import "@/styles/experience.css";
import "@/styles/motion.css";
import "@/styles/skeletons.css";
import "@/styles/contact.css";
import "@/styles/interactions.css";
import "@/styles/utilities.css";
import { SiteShell } from "@/components/layout/SiteShell";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { ThemePreferenceScript } from "@/components/theme/ThemePreferenceScript";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { SITE_LANGUAGE } from "@/lib/seo/siteConfig";
import { resolveThemeName } from "@/lib/theme/resolveThemeName";

const spaceGrotesk = Space_Grotesk({
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  display: "swap",
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

  return (
    <html lang={SITE_LANGUAGE} data-theme={initialTheme}>
      <body className={`${spaceGrotesk.className} ${spaceGrotesk.variable}`}>
        <ThemePreferenceScript initialTheme={initialTheme} />
        <SiteShell content={content} initialTheme={initialTheme}>
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
