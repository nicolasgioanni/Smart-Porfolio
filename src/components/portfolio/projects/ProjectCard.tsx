import type { ProjectItem } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { GlassChip } from "@/components/glass/GlassChip";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { PortfolioCard } from "@/components/portfolio/shared/PortfolioCard";
import { ProjectVisualTabs } from "@/components/portfolio/projects/ProjectVisualTabs";
import { ProjectStaticVisual } from "@/components/portfolio/projects/ProjectStaticVisual";
import { getSummary, limitItems } from "@/lib/content/displayHelpers";
import { getProjectActions } from "@/lib/projects/projectActions";
import { getProjectVisual } from "@/lib/projects/projectVisualRegistry";

type ProjectCardProps = {
  item: ProjectItem;
  staticVisual?: boolean;
  variant?: "summary" | "detail";
};

export function ProjectCard({ item, staticVisual = false, variant = "summary" }: ProjectCardProps) {
  if (variant === "detail") return <ProjectShowcaseCard item={item} staticVisual={staticVisual} />;

  const summary = getSummary(item.homeSummary, item.detailSummary);
  const visibleStack = limitItems(item.stack, 5);

  return (
    <PortfolioCard className="project-card" variant={variant}>
      <header className="content-card__header">
        <h3 className="content-card__title">{item.title}</h3>
        {item.subtitle ? <p className="content-card__meta project-card__subtitle">{item.subtitle}</p> : null}
      </header>
      {summary ? <p className="content-card__summary">{summary}</p> : null}
      {visibleStack.length > 0 ? (
        <div className="tag-list">
          {visibleStack.map((technology) => <GlassChip key={technology}>{technology}</GlassChip>)}
        </div>
      ) : null}
      {item.links.length > 0 ? (
        <div className="card-links">
          {limitItems(item.links, 2).map((link) => <GlassIconLink key={`${item.id}-${link.url}`} label={link.label} url={link.url} />)}
        </div>
      ) : null}
    </PortfolioCard>
  );
}

function ProjectShowcaseCard({ item, staticVisual }: { item: ProjectItem; staticVisual: boolean }) {
  const visual = getProjectVisual(item.id);
  const summary = getSummary(item.detailSummary, item.homeSummary);
  const actions = getProjectActions(item.links);

  return (
    <PortfolioCard as="article" className="project-card project-card--showcase" variant="media">
      <header className="project-card__showcase-header">
        <h3 className="content-card__title">{item.title}</h3>
        {summary ? <p className="content-card__summary">{summary}</p> : null}
      </header>
      {visual ? staticVisual ? <ProjectStaticVisual projectId={item.id} projectTitle={item.title} visual={visual} /> : <ProjectVisualTabs projectId={item.id} projectTitle={item.title} visual={visual} /> : item.image ? <img alt="" className="project-card__image" height="320" loading="lazy" src={item.image} width="640" /> : null}
      {actions.length > 0 ? (
        <div className="project-card__actions">
          {actions.map(({ label, link }) => (
            <GlassButton aria-label={`${label} for ${item.title}`} href={link.url} key={`${item.id}-${label}`} variant="secondary">
              {label}
            </GlassButton>
          ))}
        </div>
      ) : null}
    </PortfolioCard>
  );
}
