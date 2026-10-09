import type { ProjectItem } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { GlassChip } from "@/components/glass/GlassChip";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { PortfolioCard } from "@/components/portfolio/shared/PortfolioCard";
import { ProjectVisualTabs } from "@/features/projects/components/ProjectVisualTabs";
import { ProjectStaticVisual } from "@/features/projects/components/ProjectStaticVisual";
import { getSummary, limitItems } from "@/lib/content/displayHelpers";
import { getProjectActions, getProjectDiagramAction, getProjectPreviewAction } from "@/features/projects/selectors/projectActions";
import { getProjectVisual } from "@/features/projects/selectors/projectVisualRegistry";

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
  const previewAction = getProjectPreviewAction(item.links);
  const diagramAction = getProjectDiagramAction(item.links);

  return (
    <PortfolioCard as="article" className="project-card project-card--showcase" variant="media">
      <header className="project-card__showcase-header">
        <div className="project-card__showcase-title-row">
          <h3 className="content-card__title">{item.title}</h3>
          {visual?.badge ? <span className={`project-card__badge project-card__badge--${visual.badge.tone}`}><span aria-hidden="true" className="project-card__badge-icon">{visual.badge.tone === "live" ? "●" : visual.badge.tone === "installable" ? "↓" : "◷"}</span>{visual.badge.label}{visual.badge.tone === "installable" ? <span className="visually-hidden"> — Windows installer available</span> : null}</span> : null}
        </div>
        {summary ? <p className="content-card__summary">{summary}</p> : null}
      </header>
      {visual ? staticVisual ? <ProjectStaticVisual diagramAction={diagramAction} previewAction={previewAction} projectId={item.id} projectTitle={item.title} visual={visual} /> : <ProjectVisualTabs diagramAction={diagramAction} previewAction={previewAction} projectId={item.id} projectTitle={item.title} visual={visual} /> : item.image ? <img alt="" className="project-card__image" height="320" loading="lazy" src={item.image} width="640" /> : null}
      {actions.length > 0 || visual?.diagram.attribution ? (
        <footer className="project-card__footer">
          {actions.length > 0 ? (
            <div className="project-card__actions">
              {actions.map(({ label, link }) => (
                <GlassButton aria-label={`${label} for ${item.title}`} href={link.url} key={`${item.id}-${label}`} variant="secondary">
                  {label}
                </GlassButton>
              ))}
            </div>
          ) : null}
          {visual?.diagram.attribution ? <p className="project-card__attribution">{visual.diagram.attribution}</p> : null}
        </footer>
      ) : null}
    </PortfolioCard>
  );
}
