import type { SkillGroup } from "@/content/types";
import { SkillsCloud } from "@/components/portfolio/skills/SkillsCloud";

export function HomeSkillsSnapshot({ skillGroups }: { skillGroups: SkillGroup[] }) {
  return <SkillsCloud compact groups={skillGroups} />;
}
