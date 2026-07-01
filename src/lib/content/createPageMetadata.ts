import type { Metadata } from "next";
import type { GeneratedPortfolioContent } from "@/content/types";

export function createPageMetadata(content: GeneratedPortfolioContent, title?: string, description?: string): Metadata {
  const siteTitle = content.siteSettings.siteTitle || content.profile.fullName || "Portfolio";
  const siteDescription = content.siteSettings.siteDescription || content.profile.shortBio;
  const faviconPath = content.profile.faviconImage;

  return {
    title: title
      ? {
          absolute: `${title} | ${siteTitle}`
        }
      : {
          default: siteTitle,
          template: `%s | ${siteTitle}`
        },
    description: description ?? siteDescription,
    icons: faviconPath ? [{ rel: "icon", url: faviconPath }] : undefined
  };
}