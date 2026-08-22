import type { PortfolioLink, ProfileContent, ProfileOverviewContent } from "@/content/types";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { LinkIcon } from "@/components/icons/LinkIcon";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { SmartLink } from "@/components/navigation/SmartLink";
import {
  ProfileOverviewDetails,
  ProfileOverviewIntroduction
} from "@/components/portfolio/ProfileOverviewDetails";
import { getProfileIdentityItems } from "@/lib/content/profileOverview";

function getInitials(profile: ProfileContent): string {
  return profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

type PortfolioHeroProps = {
  links: PortfolioLink[];
  motionEnabled?: boolean;
  overview: ProfileOverviewContent;
  profile: ProfileContent;
};

export function PortfolioHero({ links, motionEnabled = true, overview, profile }: PortfolioHeroProps) {
  const identityItems = getProfileIdentityItems(profile, links);

  return (
    <section className="portfolio-hero profile-overview" aria-labelledby="portfolio-hero-title">
      <ScrollReveal className="portfolio-hero__reveal" enabled={motionEnabled}>
        <GlassSurface className="profile-overview__shell" variant="strong">
          <ProfileOverviewIntroduction overview={overview} />

          <div
            className="profile-overview__photo-column"
            data-has-identity-items={identityItems.length > 0 ? "true" : "false"}
          >
            <div className="profile-overview__portrait-column">
              <div className="profile-overview__portrait">
                <div className="portrait-frame" data-has-image={profile.portraitImage ? "true" : "false"}>
                  {profile.portraitImage ? (
                    <img
                      alt={profile.fullName}
                      className="portrait-image"
                      decoding="async"
                      height="420"
                      loading="eager"
                      src={profile.portraitImage}
                      width="420"
                    />
                  ) : (
                    <div
                      aria-label={`${profile.fullName} portrait placeholder`}
                      className="portrait-placeholder"
                      role="img"
                    >
                      <span>{getInitials(profile)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="profile-overview__identity">
                <p className="profile-overview__identity-name">{profile.fullName}</p>
                {profile.pronouns ? <p className="profile-overview__identity-subtitle">{profile.pronouns}</p> : null}
              </div>
            </div>
            {identityItems.length > 0 ? (
              <ul className="profile-overview__identity-list" aria-label="Profile contact details">
                {identityItems.map((item) => (
                  <li className="profile-overview__identity-item" key={item.id}>
                    {item.href ? (
                      <SmartLink
                        className="profile-overview__identity-link hover-base-1 hover-base-1--compact hover-base-1--inline"
                        href={item.href}
                      >
                        <LinkIcon kind={item.kind} />
                        <span>{item.label}</span>
                      </SmartLink>
                    ) : (
                      <span className="profile-overview__identity-static">
                        <LinkIcon kind={item.kind} />
                        <span>{item.label}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <ProfileOverviewDetails overview={overview} />
        </GlassSurface>
      </ScrollReveal>
    </section>
  );
}
