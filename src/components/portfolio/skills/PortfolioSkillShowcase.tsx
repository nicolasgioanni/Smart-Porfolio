"use client";

import { InteractiveSkillShowcase } from "@/components/portfolio/skills/InteractiveSkillShowcase";
import type { SkillItem } from "@/content/types";

type PortfolioDialogSkill = SkillItem & {
  details?: string;
  compactName?: string;
};

const compactSkillNames: Record<string, string> = {
  "TypeScript / JavaScript": "TS / JS",
  "TensorFlow / Keras": "TF / Keras",
  "LLM APIs & RAG": "LLM / RAG"
};

type PortfolioSkillShowcaseProps = {
  category: string;
  skills: readonly SkillItem[];
};

export function PortfolioSkillShowcase({ category, skills }: PortfolioSkillShowcaseProps) {
  const dialogSkills: PortfolioDialogSkill[] = skills.map((skill) => ({
    ...skill,
    compactName: Object.hasOwn(compactSkillNames, skill.name) ? compactSkillNames[skill.name] : undefined,
    details:
      skill.proficiency?.trim() && skill.summary?.trim() && skill.whereUsed?.trim()
        ? skill.whereUsed
        : undefined
  }));

  return (
    <InteractiveSkillShowcase
      detailsHeading="Where I've used it"
      getCloseAriaLabel={(skill) => `Close ${skill.name} experience`}
      getContextText={(skill) => `Proficiency · ${skill.proficiency}`}
      getTriggerAriaLabel={(skill) => `Learn about my experience with ${skill.name}`}
      items={dialogSkills}
      listAriaLabel={`${category} skills`}
      outerClassName="portfolio-skill-showcase"
    />
  );
}
