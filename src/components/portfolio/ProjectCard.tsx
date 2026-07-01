import type { ProjectItem } from "@/content/types";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassChip } from "@/components/glass/GlassChip";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { getSummary, limitItems } from "@/lib/content/displayHelpers";

type ProjectCardProps = {
  item: ProjectItem;
  variant?: "summary" | "detail";
};

export function ProjectCard({ item, variant = "summary" }: ProjectCardProps) {
  const summary = variant === "detail" ? getSummary(item.detailSummary, item.homeSummary) : getSummary(item.homeSummary, item.detailSummary);
  const visibleStack = variant === "detail" ? item.stack : limitItems(item.stack, 5);
  const showImage = variant === "detail" && item.image;

  return (
    <GlassCard className="project-card">
      {showImage ? <img alt="" className="project-card__image" height="320" loading="lazy" src={item.image} width="640" /> : null}
      <header className="content-card__header">
        <div className="content-card__meta-row">
          {item.featured ? <GlassChip tone="accent">Featured</GlassChip> : null}
          {item.subtitle ? <GlassChip tone="muted">{item.subtitle}</GlassChip> : null}
        </div>
        <h3 className="content-card__title">{item.title}</h3>
      </header>
      {summary ? <p className="content-card__summary">{summary}</p> : null}
      {variant === "detail" ? (
        <div className="project-card__deep-dive">
          {item.problem ? <p><strong>Problem:</strong> {item.problem}</p> : null}
          {item.solution ? <p><strong>Solution:</strong> {item.solution}</p> : null}
          {item.impact ? <p><strong>Impact:</strong> {item.impact}</p> : null}
        </div>
      ) : null}
      {visibleStack.length > 0 ? (
        <div className="tag-list">
          {visibleStack.map((technology) => (
            <GlassChip key={technology}>{technology}</GlassChip>
          ))}
        </div>
      ) : null}
      {item.links.length > 0 ? (
        <div className="card-links">
          {(variant === "detail" ? item.links : limitItems(item.links, 2)).map((link) => (
            <GlassIconLink key={`${item.id}-${link.url}`} label={link.label} url={link.url} />
          ))}
        </div>
      ) : null}
    </GlassCard>
  );
}