import type { HomePortfolioContent } from "@/content/types";
import { HomeEducationSummary } from "@/components/portfolio/HomeEducationSummary";
import { HomeFeaturedExperience } from "@/components/portfolio/HomeFeaturedExperience";
import { HomeFeaturedProjects } from "@/components/portfolio/HomeFeaturedProjects";
import { HomeFeaturedResearch } from "@/components/portfolio/HomeFeaturedResearch";
import { HomeOverviewSection } from "@/components/portfolio/HomeOverviewSection";
import { HomeRecommendations } from "@/components/portfolio/HomeRecommendations";
import { HomeSkillsSnapshot } from "@/components/portfolio/HomeSkillsSnapshot";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { ResumeSummary } from "@/components/portfolio/ResumeSummary";

type HomeOverviewProps = {
  content: HomePortfolioContent;
};

export function HomeOverview({ content }: HomeOverviewProps) {
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
          description="Selected engineering work with short summaries, stack context, and supporting links."
          href="/projects"
          linkLabel="View"
          motionEnabled={motionEnabled}
          title="Projects"
          wide
        >
          <HomeFeaturedProjects items={content.projects} />
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

export function FullResumePreview({ content }: HomeOverviewProps) {
  return (
    <ResumeSummary
      education={content.education}
      experience={content.experience}
      profile={content.profile}
      resume={content.resume}
      skillGroups={content.skillGroups}
    />
  );
}
