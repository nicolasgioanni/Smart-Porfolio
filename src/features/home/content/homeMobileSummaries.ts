import { splitFirstSentence } from "@/lib/content/conciseText";

// Curated presentation copy, like the detail narratives; source summaries stay intact.
const researchSummaries: Record<string, string> = {
  "cytocv-miller-lab": "Turns yeast microscopy into reviewable cell measurements.",
  "adversarial-machine-learning": "Tests image classifiers against adversarial attacks and defenses.",
  "yeast-dna-target-selection": "Automates CRISPR guide and donor design for yeast."
};

const projectSummaries: Record<string, string> = {
  notepal: "Turns study materials into notes, quizzes, and AI chat.",
  clair: "Organizes files with customizable folder rules.",
  leetnotes: "Syncs spreadsheet study notes and solutions to GitHub."
};

export function getHomeMobileSummary(kind: "research" | "projects", id: string, summary: string): string {
  const curated = kind === "research" ? researchSummaries : projectSummaries;
  return Object.hasOwn(curated, id) ? curated[id]! : splitFirstSentence(summary)[0].trim();
}
