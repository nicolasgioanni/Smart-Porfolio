import type { ResearchItem } from "@/content/types";
import { GlassChip } from "@/components/glass/GlassChip";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { getSummary, limitItems } from "@/lib/content/displayHelpers";
import { formatDateRange } from "@/lib/formatting/formatDateRange";

type ResearchCardProps = {
  item: ResearchItem;
  variant?: "summary" | "detail";
};

export function ResearchCard({ item, variant = "summary" }: ResearchCardProps) {
  const summary = variant === "detail" ? getSummary(item.detailSummary, item.homeSummary) : getSummary(item.homeSummary, item.detailSummary);
  const visibleSkills = variant === "detail" ? item.skills : limitItems(item.skills, 4);

  return (
    <PortfolioCard className="research-card" variant={variant}>
      <header className="content-card__header">
        <div className="content-card__meta-row">
          {item.featured ? <GlassChip tone="accent">Featured</GlassChip> : null}
          {item.role ? <GlassChip tone="muted">{item.role}</GlassChip> : null}
        </div>
        <h3 className="content-card__title">{item.title}</h3>
        <p className="content-card__meta">
          {[item.organization, formatDateRange(item.startDate, item.endDate), item.location].filter(Boolean).join(" / ")}
        </p>
      </header>
      {summary ? <p className="content-card__summary">{summary}</p> : null}
      {item.impact && (variant === "detail" || item.featured) ? <p className="content-card__impact">{item.impact}</p> : null}
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
      {variant === "detail" && item.links.length > 0 ? (
        <div className="card-links">
          {item.links.map((link) => (
            <GlassIconLink key={`${item.id}-${link.url}`} label={link.label} url={link.url} />
          ))}
        </div>
      ) : null}
    </PortfolioCard>
  );
}
