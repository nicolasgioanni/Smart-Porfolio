import type { GeneratedPortfolioContent } from "@/content/types";
import { BlobFooter } from "@/components/layout/BlobFooter";
import type { ThemeName } from "@/lib/theme/resolveThemeName";

type SiteFooterProps = {
  content: GeneratedPortfolioContent;
  initialTheme: ThemeName;
};

export function SiteFooter({ content, initialTheme }: SiteFooterProps) {
  return <BlobFooter content={content} initialTheme={initialTheme} />;
}
