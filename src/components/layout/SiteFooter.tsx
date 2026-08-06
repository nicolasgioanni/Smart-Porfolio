import type { GeneratedPortfolioContent } from "@/content/types";
import { BlobFooter } from "@/components/layout/BlobFooter";

type SiteFooterProps = {
  content: GeneratedPortfolioContent;
};

export function SiteFooter({ content }: SiteFooterProps) {
  return <BlobFooter content={content} />;
}
