import type { PortfolioLink, ProfileContent } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { GlassChip } from "@/components/glass/GlassChip";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { SocialLinkGroup } from "@/components/navigation/SocialLinkGroup";
import { ScrollReveal } from "@/components/motion/ScrollReveal";

function getInitials(profile: ProfileContent): string {
  return profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function PortfolioHero({ links, motionEnabled = true, profile }: { profile: ProfileContent; links: PortfolioLink[]; motionEnabled?: boolean }) {
  const currentLine = [profile.currentTitle, profile.currentCompany].filter(Boolean).join(" at ");
  const educationLine = [profile.university, profile.degree, profile.fieldOfStudy].filter(Boolean).join(" | ");

  return (
    <section className="portfolio-hero" aria-labelledby="portfolio-hero-title">
      <ScrollReveal className="portfolio-hero__main" enabled={motionEnabled}>
        <GlassSurface className="portfolio-hero__surface" variant="strong">
          <p className="eyebrow">{profile.currentTitle ?? "Portfolio"}</p>
          <h1 className="hero-title" id="portfolio-hero-title">
            {profile.fullName}
          </h1>
          <p className="hero-summary">{profile.headline}</p>
          {currentLine ? <p className="portfolio-hero__current">{currentLine}</p> : null}
          <div className="portfolio-hero__facts" aria-label="Profile facts">
            <GlassChip tone="accent">{profile.location}</GlassChip>
            {educationLine ? <GlassChip>{educationLine}</GlassChip> : null}
            {profile.graduation ? <GlassChip>Graduation {profile.graduation}</GlassChip> : null}
          </div>
          <p className="portfolio-hero__bio">{profile.shortBio}</p>
          <div className="portfolio-hero__actions">
            {profile.resumeUrl ? (
              <GlassButton href={profile.resumeUrl} variant="primary">
                {profile.resumeDownloadLabel ?? "Open resume"}
              </GlassButton>
            ) : null}
            <GlassButton href="/projects" variant="secondary">
              {profile.primaryCtaLabel ?? "View projects"}
            </GlassButton>
            <GlassButton href="/research" variant="ghost">
              {profile.secondaryCtaLabel ?? "Read research"}
            </GlassButton>
          </div>
          <SocialLinkGroup links={links} />
        </GlassSurface>
      </ScrollReveal>

      <ScrollReveal className="portfolio-hero__portrait-wrap" delay="short" enabled={motionEnabled}>
        <GlassSurface className="portfolio-hero__portrait-card" variant="default">
          <div className="portrait-frame">
            {profile.portraitImage ? (
              <img
                alt={`${profile.fullName} portrait`}
                className="portrait-image"
                height="520"
                loading="eager"
                src={profile.portraitImage}
                width="420"
              />
            ) : (
              <div aria-label={`${profile.fullName} portrait placeholder`} className="portrait-placeholder" role="img">
                {getInitials(profile)}
              </div>
            )}
          </div>
          <div className="portfolio-hero__mini-card">
            <span>Portfolio focus</span>
            <strong>{profile.headline}</strong>
          </div>
        </GlassSurface>
      </ScrollReveal>
    </section>
  );
}
