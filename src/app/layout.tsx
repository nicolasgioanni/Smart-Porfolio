import type { Metadata } from "next";
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
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent());
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = getPortfolioContent();

  return (
    <html lang="en">
      <body>
        <SiteShell content={content}>{children}</SiteShell>
      </body>
    </html>
  );
}