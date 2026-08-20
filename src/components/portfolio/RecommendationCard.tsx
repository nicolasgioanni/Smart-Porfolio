import type { RecommendationItem } from "@/content/types";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { ExpandableRecommendationText } from "@/components/portfolio/ExpandableRecommendationText";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { formatSingleDate } from "@/lib/formatting/formatDateRange";

type RecommendationCardProps = {
  item: RecommendationItem;
  variant?: "summary" | "detail";
};

function getRecommenderMeta(item: RecommendationItem): string {
  return [item.recommenderTitle, item.recommenderOrganization].filter(Boolean).join(" at ");
}

export function RecommendationCard({ item, variant = "detail" }: RecommendationCardProps) {
  const quote = item.fullQuote;
  const recommendationDate = formatSingleDate(item.recommendationDate);
  const sourceLabel = item.source || "Recommendation";
  const sourceUrl = item.sourceUrl && item.sourceUrl !== item.linkedinUrl ? item.sourceUrl : undefined;

  return (
    <PortfolioCard className={["recommendation-card", `recommendation-card--${variant}`].join(" ")} variant={variant}>
      <header className="recommendation-card__header">
        <h3 className="recommendation-card__name">{item.recommenderName}</h3>
        {getRecommenderMeta(item) ? <p className="recommendation-card__position">{getRecommenderMeta(item)}</p> : null}
        {recommendationDate || item.relationship ? (
          <p className="recommendation-card__meta">
            {recommendationDate ? <time dateTime={item.recommendationDate}>{recommendationDate}</time> : null}
            {recommendationDate && item.relationship ? <span aria-hidden="true"> · </span> : null}
            {item.relationship ? <span>{item.relationship}</span> : null}
          </p>
        ) : null}
      </header>

      <ExpandableRecommendationText id={item.id} quote={quote} recommenderName={item.recommenderName} />

      {item.linkedinUrl || sourceUrl ? (
        <div className="card-links recommendation-card__links">
          {item.linkedinUrl ? <GlassIconLink kind="linkedin" label="View on LinkedIn" url={item.linkedinUrl} /> : null}
          {sourceUrl ? <GlassIconLink label={`View ${sourceLabel}`} url={sourceUrl} /> : null}
        </div>
      ) : null}
    </PortfolioCard>
  );
}
