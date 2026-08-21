"use client";

import {
  InteractiveSkillShowcase,
  interactiveSkillDialogFadeMs
} from "@/components/portfolio/InteractiveSkillShowcase";
import type { ProjectSkill } from "@/content/types";

export const projectSkillDialogFadeMs = interactiveSkillDialogFadeMs;

type ProjectSkillShowcaseProps = {
  projectTitle: string;
  skills: readonly ProjectSkill[];
};

export function ProjectSkillShowcase({ projectTitle, skills }: ProjectSkillShowcaseProps) {
  return (
    <InteractiveSkillShowcase
      detailsHeading="Technical details"
      getContextText={() => `Used in ${projectTitle}`}
      getTriggerAriaLabel={(skill) => `Learn about ${skill.name} used in ${projectTitle}`}
      items={skills}
      listAriaLabel={`${projectTitle} technical skills`}
      outerClassName="project-skill-showcase"
    />
  );
}
