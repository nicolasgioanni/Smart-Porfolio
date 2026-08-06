import type { HomePortfolioContent } from "@/content/types";
import { HomeEducationSummary } from "@/components/portfolio/HomeEducationSummary";
import { HomeFeaturedExperience } from "@/components/portfolio/HomeFeaturedExperience";
import { HomeFeaturedProjects } from "@/components/portfolio/HomeFeaturedProjects";
import { HomeFeaturedResearch } from "@/components/portfolio/HomeFeaturedResearch";
import { HomeOverviewSection } from "@/components/portfolio/HomeOverviewSection";
import { HomeSkillsSnapshot } from "@/components/portfolio/HomeSkillsSnapshot";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { ResumeSummary } from "@/components/portfolio/ResumeSummary";
import { createHomeSkillStories, selectHomeCoreToolkit } from "@/components/portfolio/homeSkillStories";

type HomeOverviewProps = {
  content: HomePortfolioContent;
};

export function HomeOverview({ content }: HomeOverviewProps) {
  const motionEnabled = content.siteSettings.enableScrollMotion;
  const skillStories = createHomeSkillStories(content);
  const coreToolkit = selectHomeCoreToolkit(content);

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
          description="Choose a broad capability to see the projects, research, and roles where I put it into practice."
          href="/resume"
          linkLabel="See full toolkit"
          motionEnabled={motionEnabled}
          className="home-section--skills"
          title="Skills snapshot"
          wide
        >
          <HomeSkillsSnapshot skillGroups={content.skillGroups} stories={skillStories} toolkit={coreToolkit} />
        </HomeOverviewSection>

        <HomeOverviewSection
          motionEnabled={motionEnabled}
          title="Experience"
        >
          <HomeFeaturedExperience items={content.experience} />
        </HomeOverviewSection>

        <HomeOverviewSection
          description="Academic context and concise supporting details."
          motionEnabled={motionEnabled}
          title="Education summary"
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
