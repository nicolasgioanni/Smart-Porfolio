import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/glass.css";
import "@/styles/navigation.css";
import "@/styles/portfolio.css";
import "@/styles/motion.css";
import "@/styles/skeletons.css";
import "@/styles/utilities.css";
import { SiteShell } from "@/components/layout/SiteShell";
import { ThemePreferenceScript } from "@/components/theme/ThemePreferenceScript";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { resolveThemeName } from "@/lib/theme/resolveThemeName";

const inter = Inter({
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter"
});

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent());
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = getPortfolioContent();
  const initialTheme = resolveThemeName(content.siteSettings.defaultTheme);

  return (
    <html lang="en" data-theme={initialTheme}>
      <body className={`${inter.className} ${inter.variable}`}>
        <ThemePreferenceScript initialTheme={initialTheme} />
        <SiteShell content={content} initialTheme={initialTheme}>
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
