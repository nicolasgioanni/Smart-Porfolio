import type { SkillGroup } from "@/content/types";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { SkillBadge } from "@/components/portfolio/SkillBadge";

function formatCategory(category: string): string {
  return category
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function SkillsGroup({ compact = false, group }: { compact?: boolean; group: SkillGroup }) {
  if (compact) {
    return (
      <PortfolioCard as="section" className="skills-group skills-group--compact" variant="summary">
        <h3 className="skills-group__title">{formatCategory(group.category)}</h3>
        <div className="skills-group__chips">
          {group.skills.map((skill) => (
            <SkillBadge icon={skill.icon} key={skill.id} name={skill.name} />
          ))}
        </div>
      </PortfolioCard>
    );
  }

  return (
    <PortfolioCard as="section" className="skills-group" variant="summary">
      <h3 className="skills-group__title">{formatCategory(group.category)}</h3>
      <div className="skills-group__chips">
        {group.skills.map((skill) => (
          <SkillBadge icon={skill.icon} key={skill.id} name={skill.name} />
        ))}
      </div>
    </PortfolioCard>
  );
}
