import type { ProfileOverviewContent, ProfileOverviewLogo } from "@/content/types";
import { GlassLink } from "@/components/glass/GlassLink";
import { LinkIcon } from "@/components/icons/LinkIcon";
import { SmartLink } from "@/components/navigation/SmartLink";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { getLinkKind } from "@/lib/content/displayHelpers";

function getEducationProgram(degree?: string, field?: string): string | undefined {
  if (degree && field) return `${degree} \u2014 ${field}`;
  return degree ?? field;
}

function AffiliationLogo({ logo }: { logo?: ProfileOverviewLogo }) {
  if (!logo) return null;

  return (
    <span className="profile-overview__affiliation-mark">
      <img
        alt=""
        aria-hidden="true"
        className="profile-overview__affiliation-logo"
        decoding="async"
        height="48"
        loading="lazy"
        src={logo.src}
        width="48"
      />
    </span>
  );
}

type ProfileSectionHeadingProps = {
  id: string;
  children: string;
};

function ProfileSectionHeading({ children, id }: ProfileSectionHeadingProps) {
  return (
    <h2 className="profile-overview__section-heading" id={id}>
      {children}
    </h2>
  );
}

type ProfileOverviewDetailsProps = {
  overview: ProfileOverviewContent;
};

export function ProfileOverviewDetails({ overview }: ProfileOverviewDetailsProps) {
  const currentWorkTitle = overview.currentWork?.organization ?? overview.currentWork?.title;
  const currentWorkRole = overview.currentWork?.organization ? overview.currentWork.title : undefined;
  const educationProgram = getEducationProgram(overview.education?.degree, overview.education?.field);
  const educationTitle = overview.education?.institution ?? educationProgram;
  const hasIntroduction = Boolean(overview.headline || overview.about);

  return (
    <div className="profile-overview__details">
      {hasIntroduction ? (
        <header className="profile-overview__introduction">
          {overview.headline ? <p className="profile-overview__headline">{overview.headline}</p> : null}
          {overview.about ? (
            <section aria-labelledby="profile-overview-about-heading" className="profile-overview__about">
              <ProfileSectionHeading id="profile-overview-about-heading">About</ProfileSectionHeading>
              <p className="profile-overview__about-copy">{overview.about}</p>
            </section>
          ) : null}
        </header>
      ) : null}

      {overview.currentWork ? (
        <section
          aria-labelledby="profile-overview-current-work-heading"
          className="profile-overview__panel profile-overview__current-work"
        >
          <ProfileSectionHeading id="profile-overview-current-work-heading">Current Work</ProfileSectionHeading>
          <div className="profile-overview__entity">
            <AffiliationLogo logo={overview.currentWork.logo} />
            <div className="profile-overview__entity-copy">
              {currentWorkTitle ? <h3 className="profile-overview__entity-title">{currentWorkTitle}</h3> : null}
              {currentWorkRole ? <p className="profile-overview__entity-subtitle">{currentWorkRole}</p> : null}
              {overview.currentWork.dateLabel ? (
                <p className="profile-overview__metadata">{overview.currentWork.dateLabel}</p>
              ) : null}
              {overview.currentWork.summary ? (
                <p className="profile-overview__summary">{overview.currentWork.summary}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {overview.education || overview.research ? (
        <div className="profile-overview__academic-grid">
          {overview.education ? (
            <section
              aria-labelledby="profile-overview-education-heading"
              className="profile-overview__panel profile-overview__education"
            >
              <ProfileSectionHeading id="profile-overview-education-heading">Education</ProfileSectionHeading>
              <div className="profile-overview__entity">
                <AffiliationLogo logo={overview.education.logo} />
                <div className="profile-overview__entity-copy">
                  {educationTitle ? <h3 className="profile-overview__entity-title">{educationTitle}</h3> : null}
                  {overview.education.institution && educationProgram ? (
                    <p className="profile-overview__entity-subtitle">{educationProgram}</p>
                  ) : null}
                  {overview.education.concentration ? (
                    <p className="profile-overview__education-concentration">
                      <span>Concentration:</span> {overview.education.concentration}
                    </p>
                  ) : null}
                  {overview.education.graduationLabel ? (
                    <p className="profile-overview__metadata">{overview.education.graduationLabel}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {overview.research ? (
            <section
              aria-labelledby="profile-overview-research-heading"
              className="profile-overview__panel profile-overview__research"
            >
              <ProfileSectionHeading id="profile-overview-research-heading">Selected Research</ProfileSectionHeading>
              <div className="profile-overview__research-copy">
                <h3 className="profile-overview__entity-title">{overview.research.title}</h3>
                {overview.research.summary ? (
                  <p className="profile-overview__summary">{overview.research.summary}</p>
                ) : null}
                {overview.research.links.length > 0 ? (
                  <ul aria-label={`${overview.research.title} resources`} className="profile-overview__research-links">
                    {overview.research.links.map((link) => (
                      <li key={`${link.label}-${link.url}`}>
                        <SmartLink
                          className="profile-overview__research-link hover-base-1 hover-base-1--compact hover-base-1--inline"
                          href={link.url}
                        >
                          <LinkIcon kind={getLinkKind(link)} />
                          <span>{link.label}</span>
                        </SmartLink>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <nav aria-label="Related profile pages" className="profile-overview__supporting-links">
        <GlassLink className="profile-overview__supporting-link" href={siteRoutes.experience}>
          View full experience
        </GlassLink>
        <GlassLink className="profile-overview__supporting-link" href={siteRoutes.research}>
          Explore research
        </GlassLink>
      </nav>
    </div>
  );
}
