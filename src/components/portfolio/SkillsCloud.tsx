import type { SkillGroup } from "@/content/types";
import { SkillsGroup } from "@/components/portfolio/SkillsGroup";
import { EmptyState } from "@/components/portfolio/EmptyState";

export function SkillsCloud({ groups }: { groups: SkillGroup[] }) {
  if (groups.length === 0) {
    return <EmptyState message="Skills will appear here when spreadsheet rows are available." />;
  }

  return (
    <div className="skills-cloud">
      {groups.map((group) => (
        <SkillsGroup group={group} key={group.category} />
      ))}
    </div>
  );
}