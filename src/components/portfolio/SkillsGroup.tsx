import type { SkillGroup } from "@/content/types";
import { GlassChip } from "@/components/glass/GlassChip";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";

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
      <section className="skills-group skills-group--compact">
        <h3 className="skills-group__title">{formatCategory(group.category)}</h3>
        <div className="skills-group__chips">
          {group.skills.map((skill) => (
            <GlassChip key={skill.id} tone={skill.featured ? "accent" : "default"}>
              {skill.name}
            </GlassChip>
          ))}
        </div>
      </section>
    );
  }

  return (
    <PortfolioCard as="section" className="skills-group" variant="summary">
      <h3 className="skills-group__title">{formatCategory(group.category)}</h3>
      <div className="skills-group__chips">
        {group.skills.map((skill) => (
          <GlassChip key={skill.id} tone={skill.featured ? "accent" : "default"}>
            {skill.name}
          </GlassChip>
        ))}
      </div>
    </PortfolioCard>
  );
}
