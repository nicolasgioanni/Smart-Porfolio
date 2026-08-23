import type { RecommendationItem } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { LinkIcon } from "@/components/icons/LinkIcon";
import { ExpandableRecommendationText } from "@/components/portfolio/ExpandableRecommendationText";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { RecommendationVerificationLink } from "@/components/portfolio/RecommendationVerificationLink";
import { formatSingleDate } from "@/lib/formatting/formatDateRange";

type RecommendationCardProps = {
  collapsedLineCount?: number;
  expanded?: boolean;
  item: RecommendationItem;
  onExpandedChange?: (expanded: boolean) => void;
  variant?: "summary" | "detail";
};

function getRecommenderMeta(item: RecommendationItem): string {
  return [item.recommenderTitle, item.recommenderOrganization].filter(Boolean).join(" at ");
}

export function RecommendationCard({
  collapsedLineCount,
  expanded,
  item,
  onExpandedChange,
  variant = "detail"
}: RecommendationCardProps) {
  const quote = item.fullQuote;
  const recommendationDate = formatSingleDate(item.recommendationDate);
  const sourceUrl = item.sourceUrl && item.sourceUrl !== item.linkedinUrl ? item.sourceUrl : undefined;
  const showLinkedInActionIcons = variant === "detail";

  return (
    <PortfolioCard className={["recommendation-card", `recommendation-card--${variant}`].join(" ")} variant={variant}>
      <header className="recommendation-card__header">
        <div className="recommendation-card__identity-row">
          <h3 className="recommendation-card__name">{item.recommenderName}</h3>
          {sourceUrl ? (
            <RecommendationVerificationLink
              recommenderName={item.recommenderName}
              sourceUrl={sourceUrl}
              variant={variant}
            />
          ) : null}
        </div>
        {getRecommenderMeta(item) ? <p className="recommendation-card__position">{getRecommenderMeta(item)}</p> : null}
        {recommendationDate || item.relationship ? (
          <p className="recommendation-card__meta">
            {recommendationDate ? <time dateTime={item.recommendationDate}>{recommendationDate}</time> : null}
            {recommendationDate && item.relationship ? <span aria-hidden="true"> · </span> : null}
            {item.relationship ? <span>{item.relationship}</span> : null}
          </p>
        ) : null}
      </header>

      <ExpandableRecommendationText
        collapsedLineCount={collapsedLineCount}
        expanded={expanded}
        fullQuoteLink={item.fullQuoteLink}
        id={item.id}
        onExpandedChange={onExpandedChange}
        quote={quote}
        recommenderName={item.recommenderName}
      />

      {item.linkedinUrl || sourceUrl ? (
        <div className="card-links recommendation-card__links">
          {item.linkedinUrl ? (
            <GlassButton
              aria-label={`View ${item.recommenderName}'s LinkedIn profile`}
              className="recommendation-card__action recommendation-card__action--profile"
              href={item.linkedinUrl}
              variant="ghost"
            >
              {showLinkedInActionIcons ? <LinkIcon kind="linkedin" /> : null}
              <span>View profile</span>
            </GlassButton>
          ) : null}
          {sourceUrl ? (
            <GlassButton
              aria-label={`View ${item.recommenderName}'s recommendation on LinkedIn`}
              className="recommendation-card__action recommendation-card__action--recommendation"
              href={sourceUrl}
              variant="secondary"
            >
              {showLinkedInActionIcons ? <LinkIcon kind="linkedin" /> : null}
              <span>View recommendation</span>
            </GlassButton>
          ) : null}
        </div>
      ) : null}
    </PortfolioCard>
  );
}
