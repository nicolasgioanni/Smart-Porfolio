import type { PortfolioContentLink, ProjectItem } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { ProjectSkillShowcase } from "@/components/portfolio/ProjectSkillShowcase";
import { getLinkKind, getSummary } from "@/lib/content/displayHelpers";

type HomeProjectCardProps = {
  item: ProjectItem;
};

type ProjectAction = {
  label: "Source code" | "Live demo";
  link: PortfolioContentLink;
};

const projectActionOrder: Array<{ kind: string; label: ProjectAction["label"] }> = [
  { kind: "github", label: "Source code" },
  { kind: "website", label: "Live demo" }
];

function getProjectActions(links: PortfolioContentLink[]): ProjectAction[] {
  return projectActionOrder.flatMap(({ kind, label }) => {
    const link = links.find((candidate) => getLinkKind(candidate) === kind);
    return link ? [{ label, link }] : [];
  });
}

export function HomeProjectCard({ item }: HomeProjectCardProps) {
  const summary = getSummary(item.homeSummary, item.detailSummary);
  const visibleSkills = item.homeSkills.slice(0, 3);
  const actions = getProjectActions(item.links);

  return (
    <PortfolioCard className="home-project-card" variant="summary">
      <header className="home-project-card__header">
        <h3 className="home-project-card__title">{item.title}</h3>
        {item.subtitle ? <p className="home-project-card__subtitle">{item.subtitle}</p> : null}
      </header>

      {summary ? <p className="home-project-card__summary">{summary}</p> : null}

      {visibleSkills.length > 0 ? (
        <div className="home-project-card__skills">
          <ProjectSkillShowcase projectTitle={item.title} skills={visibleSkills} />
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="home-project-card__actions">
          {actions.map(({ label, link }) => (
            <GlassButton aria-label={`${label} for ${item.title}`} href={link.url} key={`${item.id}-${label}`} variant="ghost">
              {label}
            </GlassButton>
          ))}
        </div>
      ) : null}
    </PortfolioCard>
  );
}
