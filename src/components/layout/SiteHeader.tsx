import type { GeneratedPortfolioContent } from "@/content/types";
import { BlobHeader } from "@/components/layout/BlobHeader";

type SiteHeaderProps = {
  content: GeneratedPortfolioContent;
};

export function SiteHeader({ content }: SiteHeaderProps) {
  return <BlobHeader content={content} />;
}