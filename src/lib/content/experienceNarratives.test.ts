import { describe, expect, it } from "vitest";
import type { ExperienceItem } from "@/content/types";
import { getExperienceModeContent } from "@/lib/content/experienceNarratives";

function experienceWithId(id: string): ExperienceItem {
  return {
    id,
    title: "Fixture role",
    organization: "Fixture organization",
    bullets: [],
    skills: [],
    links: [],
    featured: false,
    showOnHome: false
  };
}

describe("curated Experience narratives", () => {
  it("uses the enhanced Overview evidence titles while preserving the Technical headings", () => {
    const cases = [
      {
        id: "research-assistant-software-engineering",
        overview: [
          "Scientific Workflow Automation",
          "DIC-Guided Computer Vision",
          "Production-Grade Research Infrastructure",
          "Open-Source Research Leadership"
        ],
        technical: ["Application architecture", "Vision pipeline", "Research platform", "Production delivery"]
      },
      {
        id: "undergraduate-researcher-adversarial-ml",
        overview: [
          "Adversarial ML Research Portfolio",
          "Multi-Vector Attack Engineering",
          "Layered Defense Engineering",
          "Cross-Dataset Robustness Evaluation"
        ],
        technical: [
          "Evasion and extraction",
          "Inversion and poisoning",
          "Detection and preprocessing",
          "Postprocessing and distillation"
        ]
      },
      {
        id: "research-assistant-ai-ml",
        overview: [
          "End-to-End CRISPR Workflow Automation",
          "PAM-Aware Guide & Donor Engineering",
          "Constraint-Driven Candidate Optimization",
          "Researcher-Ready Experimental Outputs"
        ],
        technical: ["Input processing", "PAM and guide discovery", "Donor construction", "XLS export and testing"]
      }
    ];

    for (const item of cases) {
      const experience = experienceWithId(item.id);

      expect(getExperienceModeContent(experience, "overview").sections.map((section) => section.title)).toEqual(item.overview);
      expect(getExperienceModeContent(experience, "technical").sections.map((section) => section.title)).toEqual(item.technical);
    }
  });
});
