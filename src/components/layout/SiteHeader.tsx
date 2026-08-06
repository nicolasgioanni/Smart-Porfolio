import type { GeneratedPortfolioContent } from "@/content/types";
import { BlobHeader } from "@/components/layout/BlobHeader";
import type { ThemeName } from "@/lib/theme/resolveThemeName";

type SiteHeaderProps = {
  content: GeneratedPortfolioContent;
  initialTheme: ThemeName;
};

export function SiteHeader({ content, initialTheme }: SiteHeaderProps) {
  return <BlobHeader content={content} initialTheme={initialTheme} />;
}
