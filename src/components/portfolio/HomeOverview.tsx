import type { HomePortfolioContent } from "@/content/types";
import { HomeEducationSummary } from "@/components/portfolio/HomeEducationSummary";
import { HomeFeaturedExperience } from "@/components/portfolio/HomeFeaturedExperience";
import { HomeFeaturedProjects } from "@/components/portfolio/HomeFeaturedProjects";
import { HomeFeaturedResearch } from "@/components/portfolio/HomeFeaturedResearch";
import { HomeOverviewSection } from "@/components/portfolio/HomeOverviewSection";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { ResumeSummary } from "@/components/portfolio/ResumeSummary";

type HomeOverviewProps = {
  content: HomePortfolioContent;
};

export function HomeOverview({ content }: HomeOverviewProps) {
  const motionEnabled = content.siteSettings.enableScrollMotion;

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
          description="Research highlights summarized for quick scanning, with deeper technical context one click away."
          href="/research"
          linkLabel="View research"
          motionEnabled={motionEnabled}
          title="Featured research"
        >
          <HomeFeaturedResearch items={content.research} />
        </HomeOverviewSection>

        <HomeOverviewSection
          description="Selected engineering work with short summaries, stack context, and supporting links."
          href="/projects"
          linkLabel="View projects"
          motionEnabled={motionEnabled}
          title="Featured projects"
          wide
        >
          <HomeFeaturedProjects items={content.projects} />
        </HomeOverviewSection>

        <HomeOverviewSection
          className="home-section--empty home-section--skills"
          motionEnabled={motionEnabled}
          title="Skills"
        />
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
