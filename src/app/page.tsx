import { HomeOverview } from "@/components/portfolio/HomeOverview";
import { HomepageStructuredData } from "@/components/seo/HomepageStructuredData";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectHomeContent } from "@/lib/content/selectHomeContent";

export default function HomePage() {
  const content = getPortfolioContent();
  const homeContent = selectHomeContent(content);

  return (
    <>
      <HomepageStructuredData content={content} />
      <HomeOverview content={homeContent} />
    </>
  );
}
