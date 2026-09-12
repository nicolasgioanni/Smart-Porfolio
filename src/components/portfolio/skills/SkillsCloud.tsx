import type { SkillGroup } from "@/content/types";
import { SkillsGroup } from "@/components/portfolio/skills/SkillsGroup";
import { EmptyState } from "@/components/portfolio/shared/EmptyState";

type SkillsCloudProps = {
  compact?: boolean;
  groups: SkillGroup[];
};

export function SkillsCloud({ compact = false, groups }: SkillsCloudProps) {
  if (groups.length === 0) {
    return <EmptyState message="Skills will appear here when content is available." />;
  }

  return (
    <div className={["skills-cloud", compact ? "skills-cloud--compact" : null].filter(Boolean).join(" ")}>
      {groups.map((group) => (
        <SkillsGroup compact={compact} group={group} key={group.category} />
      ))}
    </div>
  );
}
