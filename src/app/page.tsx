import { HomeOverview } from "@/components/portfolio/HomeOverview";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectHomeContent } from "@/lib/content/selectHomeContent";

export default function HomePage() {
  const content = getPortfolioContent();
  const homeContent = selectHomeContent(content);

  return <HomeOverview content={homeContent} />;
}
