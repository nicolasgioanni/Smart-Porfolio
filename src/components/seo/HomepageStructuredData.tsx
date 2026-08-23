import type { GeneratedPortfolioContent } from "@/content/types";
import { createHomepageStructuredData } from "@/lib/seo/createHomepageStructuredData";
import { serializeJsonLd } from "@/lib/seo/jsonLd";

type HomepageStructuredDataProps = {
  content: GeneratedPortfolioContent;
};

export function HomepageStructuredData({ content }: HomepageStructuredDataProps) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(createHomepageStructuredData(content)) }}
      type="application/ld+json"
    />
  );
}
