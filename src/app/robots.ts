import type { MetadataRoute } from "next";
import { createCanonicalUrl } from "@/lib/seo/siteConfig";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/content-version.json", "/artifact-integrity.json"]
    },
    sitemap: createCanonicalUrl("/sitemap.xml")
  };
}
