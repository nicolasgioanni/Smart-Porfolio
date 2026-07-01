import type { EducationItem, ExperienceItem, ProfileContent, ProjectItem, ResearchItem, ResumeEntry, SkillGroup } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { ResumePanel } from "@/components/portfolio/ResumePanel";
import { ResumeSection } from "@/components/portfolio/ResumeSection";
import { SkillsCloud } from "@/components/portfolio/SkillsCloud";
import { formatDateRange } from "@/lib/formatting/formatDateRange";

type ResumeSummaryProps = {
  profile: ProfileContent;
  resume: ResumeEntry[];
  experience: ExperienceItem[];
  education: EducationItem[];
  skillGroups: SkillGroup[];
  research?: ResearchItem[];
  projects?: ProjectItem[];
};

export function ResumeSummary({ education, experience, profile, projects = [], research = [], resume, skillGroups }: ResumeSummaryProps) {
  return (
    <div className="resume-summary">
      <ResumePanel>
        <div className="resume-panel__content">
          <p className="eyebrow">Resume</p>
          <h2>{profile.fullName}</h2>
          <p>{profile.headline}</p>
          <p>{[profile.location, profile.email].filter(Boolean).join(" | ")}</p>
        </div>
        {profile.resumeUrl ? (
          <GlassButton href={profile.resumeUrl} variant="primary">
            {profile.resumeDownloadLabel ?? "Open resume"}
          </GlassButton>
        ) : null}
      </ResumePanel>

      <ResumeSection title="Profile summary">
        <p className="resume-line">{profile.shortBio}</p>
        {resume.length > 0 ? (
          <div className="resume-note-list">
            {resume.map((entry) => (
              <p className="resume-line" key={`${entry.section}-${entry.key}`}>
                <strong>{entry.section.replaceAll("_", " ")}</strong>: {entry.value}
              </p>
            ))}
          </div>
        ) : null}
      </ResumeSection>

      <ResumeSection title="Experience highlights">
        {experience.length > 0 ? (
          <div className="resume-item-list">
            {experience.map((item) => (
              <article className="resume-item" key={item.id}>
                <h3>{item.title}</h3>
                <p>{[item.organization, item.type, formatDateRange(item.startDate, item.endDate)].filter(Boolean).join(" | ")}</p>
                {item.homeSummary || item.detailSummary ? <p>{item.homeSummary ?? item.detailSummary}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Experience rows will appear here when available." />
        )}
      </ResumeSection>

      <ResumeSection title="Research highlights">
        {research.length > 0 ? (
          <div className="resume-item-list">
            {research.map((item) => (
              <article className="resume-item" key={item.id}>
                <h3>{item.title}</h3>
                <p>{[item.role, item.organization, formatDateRange(item.startDate, item.endDate)].filter(Boolean).join(" | ")}</p>
                {item.homeSummary || item.detailSummary ? <p>{item.homeSummary ?? item.detailSummary}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Research rows will appear here when available." />
        )}
      </ResumeSection>

      <ResumeSection title="Project highlights">
        {projects.length > 0 ? (
          <div className="resume-item-list">
            {projects.map((item) => (
              <article className="resume-item" key={item.id}>
                <h3>{item.title}</h3>
                {item.subtitle ? <p>{item.subtitle}</p> : null}
                {item.homeSummary || item.detailSummary ? <p>{item.homeSummary ?? item.detailSummary}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Project rows will appear here when available." />
        )}
      </ResumeSection>

      <ResumeSection title="Education">
        {education.length > 0 ? (
          <div className="resume-item-list">
            {education.map((item) => (
              <article className="resume-item" key={item.id}>
                <h3>{item.institution}</h3>
                <p>{[item.degree, item.field, formatDateRange(item.startDate, item.endDate)].filter(Boolean).join(" | ")}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Education rows will appear here when available." />
        )}
      </ResumeSection>

      <ResumeSection title="Skills">
        <SkillsCloud groups={skillGroups} />
      </ResumeSection>
    </div>
  );
}