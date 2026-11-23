import { HomeOverview } from "@/features/home/components/HomeOverview";
import { HomepageStructuredData } from "@/components/seo/HomepageStructuredData";
import { HomeFeaturedProjects } from "@/features/home/components/HomeFeaturedProjects";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectHomeContent } from "@/features/home/content/selectHomeContent";

export default function HomePage() {
  const content = getPortfolioContent();
  const homeContent = selectHomeContent(content);

  return (
    <>
      <HomepageStructuredData content={content} />
      <HomeOverview content={homeContent} projectHighlights={<HomeFeaturedProjects items={homeContent.projects} />} />
    </>
  );
}
