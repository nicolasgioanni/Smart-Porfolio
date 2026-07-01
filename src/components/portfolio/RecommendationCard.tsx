import type { RecommendationItem } from "@/content/types";
import { GlassChip } from "@/components/glass/GlassChip";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { createRecommendationExcerpt } from "@/lib/content/selectHomeContent";
import { formatSingleDate } from "@/lib/formatting/formatDateRange";

type RecommendationCardProps = {
  item: RecommendationItem;
  variant?: "summary" | "detail";
};

function getRecommenderMeta(item: RecommendationItem): string {
  return [item.recommenderTitle, item.recommenderOrganization].filter(Boolean).join(" / ");
}

export function RecommendationCard({ item, variant = "detail" }: RecommendationCardProps) {
  const quote = variant === "summary" ? item.homeQuote || createRecommendationExcerpt(item.fullQuote) : item.fullQuote;
  const recommendationDate = formatSingleDate(item.recommendationDate);
  const sourceLabel = item.source || "Recommendation";
  const sourceUrl = item.sourceUrl && item.sourceUrl !== item.linkedinUrl ? item.sourceUrl : undefined;

  return (
    <PortfolioCard className={["recommendation-card", `recommendation-card--${variant}`].join(" ")} variant={variant}>
      <header className="content-card__header">
        <div className="content-card__meta-row">
          {item.featured ? <GlassChip tone="accent">Featured</GlassChip> : null}
          <GlassChip tone="muted">{sourceLabel}</GlassChip>
          {recommendationDate ? <GlassChip>{recommendationDate}</GlassChip> : null}
        </div>
        <div>
          <h3 className="content-card__title">{item.recommenderName}</h3>
          {getRecommenderMeta(item) ? <p className="content-card__meta">{getRecommenderMeta(item)}</p> : null}
        </div>
      </header>

      <blockquote className="recommendation-card__quote">{quote}</blockquote>

      {variant === "detail" && item.relationship ? <p className="content-card__summary">{item.relationship}</p> : null}
      {variant === "detail" && item.context ? <p className="content-card__impact">{item.context}</p> : null}

      {item.skills.length > 0 ? (
        <div className="tag-list">
          {item.skills.map((skill) => (
            <GlassChip key={skill}>{skill}</GlassChip>
          ))}
        </div>
      ) : null}

      {item.linkedinUrl || sourceUrl ? (
        <div className="card-links">
          {item.linkedinUrl ? <GlassIconLink kind="linkedin" label="View on LinkedIn" url={item.linkedinUrl} /> : null}
          {sourceUrl ? <GlassIconLink label={`View ${sourceLabel}`} url={sourceUrl} /> : null}
        </div>
      ) : null}
    </PortfolioCard>
  );
}
