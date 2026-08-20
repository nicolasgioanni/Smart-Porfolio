import type { PortfolioContentLink, ResearchItem } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { getLinkKind, getSummary } from "@/lib/content/displayHelpers";
import { formatProfileOverviewDateRange } from "@/lib/content/profileOverview";

type HomeResearchCardProps = {
  item: ResearchItem;
};

type ResearchAction = {
  label: "Source code" | "Manuscript" | "Live demo";
  link: PortfolioContentLink;
};

const researchActionOrder: Array<{ kind: string; label: ResearchAction["label"] }> = [
  { kind: "github", label: "Source code" },
  { kind: "publication", label: "Manuscript" },
  { kind: "website", label: "Live demo" }
];

function getResearchActions(links: PortfolioContentLink[]): ResearchAction[] {
  return researchActionOrder.flatMap(({ kind, label }) => {
    const link = links.find((candidate) => getLinkKind(candidate) === kind);
    return link ? [{ label, link }] : [];
  });
}

export function HomeResearchCard({ item }: HomeResearchCardProps) {
  const displayTitle = item.homeTitle?.trim() || item.title;
  const dateLabel = formatProfileOverviewDateRange(item.startDate, item.endDate);
  const summary = getSummary(item.homeSummary, item.detailSummary);
  const actions = getResearchActions(item.links);

  return (
    <PortfolioCard className="home-research-card" variant="summary">
      <header className="home-research-card__header">
        <h3 className="home-research-card__title">{displayTitle}</h3>
        {item.organization ? <p className="home-research-card__organization">{item.organization}</p> : null}
        {dateLabel ? <p className="home-research-card__date">{dateLabel}</p> : null}
        {item.location ? <p className="home-research-card__location">{item.location}</p> : null}
      </header>

      {summary ? <p className="home-research-card__summary">{summary}</p> : null}

      {actions.length > 0 ? (
        <div className="home-research-card__actions">
          {actions.map(({ label, link }) => (
            <GlassButton aria-label={`${label} for ${displayTitle}`} href={link.url} key={`${item.id}-${label}`} variant="ghost">
              {label}
            </GlassButton>
          ))}
        </div>
      ) : null}
    </PortfolioCard>
  );
}
