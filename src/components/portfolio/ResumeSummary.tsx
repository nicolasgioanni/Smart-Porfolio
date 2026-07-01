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

function joinResumeMeta(values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" / ");
}

function formatResumeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function isNoopResumeEntry(entry: ResumeEntry): boolean {
  return entry.key === "heading" && entry.value.trim().toLowerCase() === formatResumeLabel(entry.section).toLowerCase();
}

function groupResumeNotes(resume: ResumeEntry[]): Array<[string, ResumeEntry[]]> {
  const grouped = resume
    .filter((entry) => !isNoopResumeEntry(entry))
    .reduce<Map<string, ResumeEntry[]>>((groups, entry) => {
      const entries = groups.get(entry.section) ?? [];
      entries.push(entry);
      groups.set(entry.section, entries);
      return groups;
    }, new Map<string, ResumeEntry[]>());

  return Array.from(grouped.entries());
}

export function ResumeSummary({ education, experience, profile, projects = [], research = [], resume, skillGroups }: ResumeSummaryProps) {
  const resumeNoteGroups = groupResumeNotes(resume);

  return (
    <div className="resume-summary">
      <ResumePanel>
        <div className="resume-panel__content">
          <p className="eyebrow">Resume</p>
          <h2>{profile.fullName}</h2>
          <p>{profile.headline}</p>
          <p>{joinResumeMeta([profile.location, profile.email])}</p>
        </div>
        {profile.resumeUrl ? (
          <GlassButton href={profile.resumeUrl} variant="primary">
            {profile.resumeDownloadLabel ?? "Open resume"}
          </GlassButton>
        ) : null}
      </ResumePanel>

      <ResumeSection title="Profile summary">
        <p className="resume-line">{profile.shortBio}</p>
        {resumeNoteGroups.length > 0 ? (
          <div className="resume-note-list">
            {resumeNoteGroups.map(([section, entries]) => (
              <section className="resume-note-group" key={section}>
                <h3 className="resume-note-group__title">{formatResumeLabel(section)}</h3>
                <div className="resume-note-group__items">
                  {entries.map((entry) => (
                    <p className="resume-note" key={`${entry.section}-${entry.key}`}>
                      <span>{formatResumeLabel(entry.key)}</span>
                      <span>{entry.value}</span>
                    </p>
                  ))}
                </div>
              </section>
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
                <p>{joinResumeMeta([item.organization, item.type, formatDateRange(item.startDate, item.endDate)])}</p>
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
                <p>{joinResumeMeta([item.role, item.organization, formatDateRange(item.startDate, item.endDate)])}</p>
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
                <p>{joinResumeMeta([item.degree, item.field, formatDateRange(item.startDate, item.endDate)])}</p>
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
