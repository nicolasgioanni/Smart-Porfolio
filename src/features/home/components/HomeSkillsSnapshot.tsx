import type { SkillGroup } from "@/content/types";
import { SkillsCloud } from "@/features/skills/components/SkillsCloud";

export function HomeSkillsSnapshot({ skillGroups }: { skillGroups: SkillGroup[] }) {
  return <SkillsCloud compact groups={skillGroups} />;
}
