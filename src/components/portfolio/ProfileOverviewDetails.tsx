import type { ProfileOverviewContent, ProfileOverviewLogo } from "@/content/types";
import { SmartLink } from "@/components/navigation/SmartLink";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { AnimatedRole } from "@/components/portfolio/AnimatedRole";
import { formatEducationProgram } from "@/lib/content/profileOverview";

const profileResearchResourceClassName =
  "profile-overview__research-link hover-base-1 hover-base-1--compact hover-base-1--inline";

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

type ProfilePanelHeaderProps = ProfileSectionHeadingProps & {
  actionHref?: string;
  actionLabel?: string;
};

function ProfilePanelHeader({ actionHref, actionLabel, children, id }: ProfilePanelHeaderProps) {
  const hasAction = Boolean(actionHref && actionLabel);

  return (
    <header
      className={`profile-overview__panel-header${hasAction ? " profile-overview__panel-header--with-action" : ""}`}
    >
      <ProfileSectionHeading id={id}>{children}</ProfileSectionHeading>
      {actionHref && actionLabel ? (
        <span className="profile-overview__panel-action-slot">
          <SmartLink
            className="profile-overview__panel-action hover-base-1 hover-base-1--compact hover-base-1--inline"
            href={actionHref}
          >
            {actionLabel}
          </SmartLink>
        </span>
      ) : null}
    </header>
  );
}

type ProfileOverviewDetailsProps = {
  overview: ProfileOverviewContent;
};

export function ProfileOverviewDetails({ overview }: ProfileOverviewDetailsProps) {
  const currentWorkTitle = overview.currentWork?.organization ?? overview.currentWork?.title;
  const currentWorkRole = overview.currentWork?.organization ? overview.currentWork.title : undefined;
  const educationProgram = formatEducationProgram(overview.education?.degree, overview.education?.field);
  const educationTitle = overview.education?.institution ?? educationProgram;

  return (
    <div className="profile-overview__details">
      <header className="profile-overview__introduction">
        <div className="profile-overview__greeting-group">
          <h1 className="profile-overview__greeting" id="portfolio-hero-title">
            Hi, I’m {overview.greetingName}
          </h1>
          <AnimatedRole role={overview.role} />
        </div>
        {overview.about ? (
          <section aria-labelledby="profile-overview-about-heading" className="profile-overview__about">
            <ProfileSectionHeading id="profile-overview-about-heading">About</ProfileSectionHeading>
            <p className="profile-overview__about-copy">{overview.about}</p>
          </section>
        ) : null}
      </header>

      {overview.currentWork ? (
        <section
          aria-labelledby="profile-overview-current-work-heading"
          className="profile-overview__panel profile-overview__current-work"
        >
          <ProfilePanelHeader
            actionHref={siteRoutes.experience}
            actionLabel="View experience"
            id="profile-overview-current-work-heading"
          >
            Current Work
          </ProfilePanelHeader>
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
              <ProfilePanelHeader id="profile-overview-education-heading">Education</ProfilePanelHeader>
              <div className="profile-overview__entity">
                <AffiliationLogo logo={overview.education.logo} />
                <div className="profile-overview__entity-copy">
                  {educationTitle ? <h3 className="profile-overview__entity-title">{educationTitle}</h3> : null}
                  {overview.education.institution && (educationProgram || overview.education.concentration) ? (
                    <dl className="profile-overview__academic-details">
                      {educationProgram ? (
                        <div className="profile-overview__academic-detail">
                          <dt>Degree</dt>
                          <dd>{educationProgram}</dd>
                        </div>
                      ) : null}
                      {overview.education.concentration ? (
                        <div className="profile-overview__academic-detail">
                          <dt>Concentration</dt>
                          <dd>{overview.education.concentration}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                  {overview.education.graduationLabel ? (
                    <p className="profile-overview__metadata profile-overview__academic-footer">
                      {overview.education.graduationLabel}
                    </p>
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
              <ProfilePanelHeader
                actionHref={siteRoutes.research}
                actionLabel="View research"
                id="profile-overview-research-heading"
              >
                Research
              </ProfilePanelHeader>
              <div className="profile-overview__entity">
                <AffiliationLogo logo={overview.research.logo} />
                <div className="profile-overview__entity-copy profile-overview__research-copy">
                  <h3 className="profile-overview__entity-title">{overview.research.title}</h3>
                  {overview.research.summary ? (
                    <p className="profile-overview__summary">{overview.research.summary}</p>
                  ) : null}
                </div>
              </div>
              {overview.research.links.length > 0 || overview.research.pendingLinks.length > 0 ? (
                <ul
                  aria-label={`${overview.research.title} resources`}
                  className="profile-overview__research-links profile-overview__academic-footer"
                >
                  {overview.research.links.map((link) => (
                    <li key={`${link.label}-${link.url}`}>
                      <SmartLink className={profileResearchResourceClassName} href={link.url}>
                        {link.label}
                      </SmartLink>
                    </li>
                  ))}
                  {overview.research.pendingLinks.map((label) => (
                    <li key={`pending-${label}`}>
                      <button
                        aria-label={`${label} — not yet published`}
                        className={`${profileResearchResourceClassName} profile-overview__research-link--pending`}
                        disabled
                        title="Not yet published"
                        type="button"
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
