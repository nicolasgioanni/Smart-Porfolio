import type { SkillGroup } from "@/content/types";
import { GlassChip } from "@/components/glass/GlassChip";

function formatCategory(category: string): string {
  return category.replaceAll("_", " ");
}

export function SkillsGroup({ group }: { group: SkillGroup }) {
  return (
    <section className="skills-group">
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