import type { SkillGroup } from "@/content/types";
import { SkillsCloud } from "@/components/portfolio/SkillsCloud";

type SkillsSummaryProps = {
  skillGroups: SkillGroup[];
};

export function SkillsSummary({ skillGroups }: SkillsSummaryProps) {
  return <SkillsCloud groups={skillGroups} />;
}