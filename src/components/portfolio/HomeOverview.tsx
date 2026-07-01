import type { HomePortfolioContent } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
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

  return (
    <div className="page-container page-container--home">
      <PortfolioHero links={content.links} motionEnabled={motionEnabled} profile={content.profile} />

      <div className="home-overview-grid" aria-label="Portfolio overview">
        <HomeOverviewSection
          description="A compact snapshot of the tools, languages, and domains most relevant to current work."
          eyebrow="Skills"
          href="/resume"
          linkLabel="See resume"
          motionEnabled={motionEnabled}
          title="Skills snapshot"
          wide
        >
          <HomeSkillsSnapshot skillGroups={content.skillGroups} />
        </HomeOverviewSection>

        <HomeOverviewSection
          description="Selected roles showing engineering, research, teaching, and leadership context."
          eyebrow="Experience"
          href="/experience"
          linkLabel="View all experience"
          motionEnabled={motionEnabled}
          title="Featured experience"
        >
          <HomeFeaturedExperience items={content.experience} />
        </HomeOverviewSection>

        <HomeOverviewSection
          description="Research highlights summarized for quick scanning, with deeper technical context one click away."
          eyebrow="Research"
          href="/research"
          linkLabel="View research"
          motionEnabled={motionEnabled}
          title="Featured research"
        >
          <HomeFeaturedResearch items={content.research} />
        </HomeOverviewSection>

        <HomeOverviewSection
          description="Selected engineering work with short summaries, stack context, and supporting links."
          eyebrow="Projects"
          href="/projects"
          linkLabel="View projects"
          motionEnabled={motionEnabled}
          title="Featured projects"
          wide
        >
          <HomeFeaturedProjects items={content.projects} />
        </HomeOverviewSection>

        {content.recommendations.length > 0 ? (
          <HomeOverviewSection
            description="Concise professional social proof, with source links when available."
            eyebrow="Recommendations"
            href="/recommendations"
            linkLabel="View recommendations"
            motionEnabled={motionEnabled}
            title="Professional recommendations"
            className="home-section--recommendations"
            wide
          >
            <HomeRecommendations items={content.recommendations} showAction={false} />
          </HomeOverviewSection>
        ) : null}

        <HomeOverviewSection
          description="Academic context and concise supporting details."
          eyebrow="Education"
          motionEnabled={motionEnabled}
          title="Education summary"
        >
          <HomeEducationSummary items={content.education} />
        </HomeOverviewSection>

        <HomeOverviewSection
          description="Download the resume file or scan the resume page."
          eyebrow="Resume"
          href="/resume"
          linkLabel="Open resume page"
          motionEnabled={motionEnabled}
          title="Resume and contact"
          wide
        >
          <div className="home-resume-preview">
            <p>{content.profile.shortBio}</p>
            <div className="home-resume-preview__actions">
              {content.profile.resumeUrl ? (
                <GlassButton href={content.profile.resumeUrl} variant="primary">
                  {content.profile.resumeDownloadLabel ?? "Open resume"}
                </GlassButton>
              ) : null}
              <GlassButton href="/resume" variant="secondary">
                View resume page
              </GlassButton>
            </div>
          </div>
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
