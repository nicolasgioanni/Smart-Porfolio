import type { ExperienceItem } from "@/content/types";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassChip } from "@/components/glass/GlassChip";
import { getSummary, limitItems } from "@/lib/content/displayHelpers";
import { formatDateRange } from "@/lib/formatting/formatDateRange";

type ExperienceTimelineItemProps = {
  item: ExperienceItem;
  variant?: "summary" | "detail";
};

export function ExperienceTimelineItem({ item, variant = "detail" }: ExperienceTimelineItemProps) {
  const summary = variant === "detail" ? getSummary(item.detailSummary, item.homeSummary) : getSummary(item.homeSummary, item.detailSummary);
  const visibleSkills = variant === "detail" ? item.skills : limitItems(item.skills, 4);

  return (
    <div className="timeline-item">
      <div aria-hidden="true" className="timeline-item__marker" />
      <GlassCard className="timeline-item__card">
        <header className="content-card__header">
          <div className="content-card__meta-row">
            {item.type ? <GlassChip tone="accent">{item.type}</GlassChip> : null}
            {item.featured ? <GlassChip tone="muted">Featured</GlassChip> : null}
          </div>
          <h3 className="content-card__title">{item.title}</h3>
          <p className="content-card__meta">
            {[item.organization, formatDateRange(item.startDate, item.endDate), item.location].filter(Boolean).join(" | ")}
          </p>
        </header>
        {summary ? <p className="content-card__summary">{summary}</p> : null}
        {variant === "detail" && item.bullets.length > 0 ? (
          <ul className="content-card__details">
            {item.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        {visibleSkills.length > 0 ? (
          <div className="tag-list">
            {visibleSkills.map((skill) => (
              <GlassChip key={skill}>{skill}</GlassChip>
            ))}
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}