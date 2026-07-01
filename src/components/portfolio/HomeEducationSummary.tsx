import type { EducationItem } from "@/content/types";
import { GlassChip } from "@/components/glass/GlassChip";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { formatDateRange } from "@/lib/formatting/formatDateRange";

export function HomeEducationSummary({ items }: { items: EducationItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="Education rows will appear here when content is available." />;
  }

  return (
    <div className="education-summary-list">
      {items.map((item) => (
        <PortfolioCard className="education-card" key={item.id} variant="compact">
          <header className="content-card__header">
            <h3 className="content-card__title">{item.institution}</h3>
            <p className="content-card__meta">
              {[item.degree, item.field, item.location, formatDateRange(item.startDate, item.endDate)].filter(Boolean).join(" / ")}
            </p>
          </header>
          {item.homeSummary ? <p className="content-card__summary">{item.homeSummary}</p> : null}
          {item.bullets.length > 0 ? (
            <div className="tag-list">
              {item.bullets.slice(0, 2).map((bullet) => (
                <GlassChip key={bullet}>{bullet}</GlassChip>
              ))}
            </div>
          ) : null}
        </PortfolioCard>
      ))}
    </div>
  );
}
