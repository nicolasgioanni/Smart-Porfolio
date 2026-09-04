import type { Metadata } from "next";
import {
  isIndexableSiteRoutePath,
  type SiteRoutePath
} from "@/components/navigation/siteRoutes";
import type { GeneratedPortfolioContent } from "@/content/types";
import {
  CANONICAL_HOMEPAGE_URL,
  CANONICAL_SITE_ORIGIN,
  OPEN_GRAPH_LOCALE,
  PREFERRED_SITE_NAME,
  createCanonicalUrl
} from "@/lib/seo/siteConfig";

export type CreatePageMetadataOptions = {
  pathname: SiteRoutePath;
  title?: string;
  description?: string;
};

function resolveCanonicalProfileImage(imagePath: string | undefined): string | undefined {
  if (!imagePath?.startsWith("/") || imagePath.startsWith("//")) return undefined;

  try {
    return createCanonicalUrl(imagePath);
  } catch {
    return undefined;
  }
}

export function createPageMetadata(
  content: GeneratedPortfolioContent,
  { pathname, title, description }: CreatePageMetadataOptions
): Metadata {
  const siteTitle = content.siteSettings.siteTitle || content.profile.fullName || "Portfolio";
  const pageTitlePrefix = content.profile.fullName || PREFERRED_SITE_NAME;
  const siteDescription = content.siteSettings.siteDescription || content.profile.shortBio;
  const faviconPath = content.profile.faviconImage;
  const pageDescription = description ?? siteDescription;
  const resolvedTitle = title ? `${pageTitlePrefix} | ${title}` : siteTitle;
  const canonicalUrl = createCanonicalUrl(pathname);
  const indexable = isIndexableSiteRoutePath(pathname);
  const profileImage = resolveCanonicalProfileImage(content.profile.portraitImage);
  const socialImages = profileImage
    ? [
        {
          url: profileImage,
          alt: `${PREFERRED_SITE_NAME} profile portrait`
        }
      ]
    : undefined;

  return {
    metadataBase: new URL(CANONICAL_SITE_ORIGIN),
    title: title
      ? {
          absolute: resolvedTitle
        }
      : {
          default: siteTitle,
          template: `${pageTitlePrefix} | %s`
        },
    description: pageDescription,
    applicationName: PREFERRED_SITE_NAME,
    authors: [{ name: PREFERRED_SITE_NAME, url: CANONICAL_HOMEPAGE_URL }],
    creator: PREFERRED_SITE_NAME,
    publisher: PREFERRED_SITE_NAME,
    icons: faviconPath ? [{ rel: "icon", url: faviconPath }] : undefined,
    alternates: {
      canonical: canonicalUrl
    },
    robots: {
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    openGraph: {
      type: "website",
      locale: OPEN_GRAPH_LOCALE,
      url: canonicalUrl,
      siteName: PREFERRED_SITE_NAME,
      title: resolvedTitle,
      description: pageDescription,
      images: socialImages
    },
    twitter: {
      card: "summary",
      title: resolvedTitle,
      description: pageDescription,
      images: socialImages
    }
  };
}
