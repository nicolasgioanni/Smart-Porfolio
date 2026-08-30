import type { MetadataRoute } from "next";
import { indexableSiteRoutePaths } from "@/components/navigation/siteRoutes";
import { createCanonicalUrl } from "@/lib/seo/siteConfig";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexableSiteRoutePaths.map((pathname) => ({
    url: createCanonicalUrl(pathname)
  }));
}
