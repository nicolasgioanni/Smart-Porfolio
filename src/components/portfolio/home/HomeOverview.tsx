import type { HomePortfolioContent } from "@/content/types";
import type { ReactNode } from "react";
import { HomeEducationSummary } from "@/components/portfolio/home/HomeEducationSummary";
import { HomeFeaturedExperience } from "@/components/portfolio/home/HomeFeaturedExperience";
import { HomeFeaturedResearch } from "@/components/portfolio/home/HomeFeaturedResearch";
import { HomeOverviewSection } from "@/components/portfolio/home/HomeOverviewSection";
import { HomeRecommendations } from "@/components/portfolio/home/HomeRecommendations";
import { HomeSkillsSnapshot } from "@/components/portfolio/home/HomeSkillsSnapshot";
import { PortfolioHero } from "@/components/portfolio/home/PortfolioHero";

type HomeOverviewProps = {
  content: HomePortfolioContent;
  projectHighlights: ReactNode;
};

export function HomeOverview({ content, projectHighlights }: HomeOverviewProps) {
  const motionEnabled = content.siteSettings.enableScrollMotion;
  const showRecommendations =
    content.siteSettings.enableRecommendations !== false &&
    (content.recommendations.length > 0 || content.siteSettings.showEmptyRecommendations === true);

  return (
    <div className="page-container page-container--home">
      <PortfolioHero
        links={content.links}
        motionEnabled={motionEnabled}
        overview={content.profileOverview}
        profile={content.profile}
      />

      <div className="home-overview-grid" aria-label="Portfolio overview">
        <HomeOverviewSection
          actionAriaLabel="View Experience"
          actionVariant="button"
          href="/experience"
          linkLabel="View"
          motionEnabled={motionEnabled}
          title="Experience"
        >
          <HomeFeaturedExperience items={content.experience} />
        </HomeOverviewSection>

        <HomeOverviewSection
          motionEnabled={motionEnabled}
          title="Education"
        >
          <HomeEducationSummary items={content.education} />
        </HomeOverviewSection>

        <HomeOverviewSection
          actionAriaLabel="View Research"
          actionVariant="button"
          href="/research"
          linkLabel="View"
          motionEnabled={motionEnabled}
          title="Research"
          wide
        >
          <HomeFeaturedResearch items={content.research} />
        </HomeOverviewSection>

        <HomeOverviewSection
          actionAriaLabel="View Projects"
          actionVariant="button"
          href="/projects"
          linkLabel="View"
          motionEnabled={motionEnabled}
          title="Projects"
          wide
        >
          {projectHighlights}
        </HomeOverviewSection>

        <HomeOverviewSection
          className="home-section--skills"
          motionEnabled={motionEnabled}
          title="Skills"
          wide
        >
          <HomeSkillsSnapshot skillGroups={content.skillGroups} />
        </HomeOverviewSection>

        {showRecommendations ? (
          <HomeOverviewSection
            actionAriaLabel="View Recommendations"
            actionVariant="button"
            className="home-section--recommendations"
            href="/recommendations"
            linkLabel="View"
            motionEnabled={motionEnabled}
            title="Recommendations"
            wide
          >
            <HomeRecommendations items={content.recommendations} showAction={false} />
          </HomeOverviewSection>
        ) : null}
      </div>
    </div>
  );
}
