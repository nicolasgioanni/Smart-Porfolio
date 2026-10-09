export type ProjectDiagramNode = {
  detail?: string;
  label: string;
  x: number;
  y: number;
};

export type ProjectDiagram = {
  attribution?: string;
  description: string;
  nodes: readonly ProjectDiagramNode[];
  title: string;
};

export type ProjectVisual = {
  concept: {
    alt: string;
    height: number;
    src: string;
    width: number;
  };
  diagram: ProjectDiagram;
};

export const projectVisualRegistry = {
  "compliance-label-assistant": {
    concept: {
      alt: "A bottle label passing through a scanning frame into a field review panel.",
      height: 992,
      src: "/images/projects/compliance-label-assistant-concept.webp",
      width: 1586
    },
    diagram: {
      description: "A label image moves through AI extraction and rule comparison before a reviewer sees the result.",
      nodes: [
        { detail: "photo", label: "Label image", x: 18, y: 136 },
        { detail: "fields", label: "AI extraction", x: 162, y: 136 },
        { detail: "rules", label: "Rule comparison", x: 306, y: 136 },
        { detail: "review", label: "Reviewer results", x: 450, y: 136 }
      ],
      title: "Label image to reviewer results"
    }
  },
  notepal: {
    concept: {
      alt: "Documents, image cards, and media converging into a structured study notebook.",
      height: 992,
      src: "/images/projects/notepal-concept.webp",
      width: 1586
    },
    diagram: {
      attribution: "Co-developed with Parth Gupta.",
      description: "Study materials are processed into structured notes, then support quizzes and context-aware chat.",
      nodes: [
        { detail: "files", label: "Study material", x: 18, y: 136 },
        { detail: "media", label: "Content processing", x: 162, y: 136 },
        { detail: "notebook", label: "Structured notes", x: 306, y: 136 },
        { detail: "practice", label: "Quizzes + chat", x: 450, y: 136 }
      ],
      title: "Study material to quizzes and chat"
    }
  },
  "tergion-technologies": {
    concept: {
      alt: "A business intake form connected to contact records and a confirmation envelope.",
      height: 992,
      src: "/images/projects/tergion-technologies-concept.webp",
      width: 1586
    },
    diagram: {
      description: "An inquiry is validated, synchronized to CRM records, and followed by a confirmation email.",
      nodes: [
        { detail: "inquiry", label: "Inquiry", x: 18, y: 136 },
        { detail: "checks", label: "Validated submission", x: 162, y: 136 },
        { detail: "record", label: "CRM sync", x: 306, y: 136 },
        { detail: "email", label: "Confirmation", x: 450, y: 136 }
      ],
      title: "Inquiry to confirmation"
    }
  },
  leetnotes: {
    concept: {
      alt: "Spreadsheet cells becoming organized study notes and language-aware code files.",
      height: 992,
      src: "/images/projects/leetnotes-concept.webp",
      width: 1586
    },
    diagram: {
      description: "Spreadsheet notes are normalized, converted to notes and solutions, then synchronized to GitHub.",
      nodes: [
        { detail: "rows", label: "Sheets", x: 18, y: 136 },
        { detail: "clean", label: "Normalize", x: 162, y: 136 },
        { detail: "files", label: "Notes + solutions", x: 306, y: 136 },
        { detail: "schedule", label: "GitHub updates", x: 450, y: 136 }
      ],
      title: "Sheets to scheduled GitHub updates"
    }
  },
  clair: {
    concept: {
      alt: "Scattered files arranged into clearly labelled folders on a desktop workspace.",
      height: 992,
      src: "/images/projects/clair-concept.webp",
      width: 1586
    },
    diagram: {
      description: "A chosen folder uses a reusable preset and file-extension rules to create organized folders.",
      nodes: [
        { detail: "choose", label: "Choose folder", x: 18, y: 136 },
        { detail: "preset", label: "Apply preset", x: 162, y: 136 },
        { detail: "rules", label: "Sort by extension", x: 306, y: 136 },
        { detail: "folders", label: "Organized folders", x: 450, y: 136 }
      ],
      title: "Folder selection to organized folders"
    }
  }
} as const satisfies Record<string, ProjectVisual>;

export function getProjectVisual(id: string): ProjectVisual | undefined {
  return Object.hasOwn(projectVisualRegistry, id) ? projectVisualRegistry[id as keyof typeof projectVisualRegistry] : undefined;
}
