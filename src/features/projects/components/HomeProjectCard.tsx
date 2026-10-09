import type { ProjectItem } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { PortfolioCard } from "@/components/portfolio/shared/PortfolioCard";
import { ProjectSkillShowcase } from "@/features/projects/components/ProjectSkillShowcase";
import { getSummary } from "@/lib/content/displayHelpers";
import { HomeCardSummary } from "@/components/portfolio/home/HomeCardSummary";
import { getProjectActions } from "@/features/projects/selectors/projectActions";

type HomeProjectCardProps = {
  item: ProjectItem;
};

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

      {summary ? <HomeCardSummary className="home-project-card__summary" id={item.id} kind="projects" summary={summary} /> : null}

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
