import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

export function shouldRenderSkeletons(): boolean {
  return getPortfolioContent().siteSettings.enableSkeletons !== false;
}
