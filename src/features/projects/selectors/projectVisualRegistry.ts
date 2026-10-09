export type ProjectDiagramNode = { detail?: string; label: string; x: number; y: number };
export type ProjectDiagram = { attribution?: string; description: string; nodes: readonly ProjectDiagramNode[]; title: string };
export type ProjectPreviewMobileAsset = { height: number; src: string; width: number };
export type ProjectPreview =
  | { alt: string; fit: "contain" | "cover"; height: number; kind: "screenshot"; mobile?: ProjectPreviewMobileAsset; src: string; width: number }
  | { fallback: { alt: string; src: string }; height: number; kind: "leetnotes"; width: number };
export type ProjectPreviewBadge = { label: "Live site" | "Installable" | "Scheduled"; tone: "installable" | "live" | "scheduled" };
export type ProjectVisual = { badge?: ProjectPreviewBadge; diagram: ProjectDiagram; preview: ProjectPreview };

export const projectVisualRegistry = {
  "compliance-label-assistant": {
    badge: { label: "Live site", tone: "live" },
    preview: {
      alt: "Compliance Label Assistant homepage introducing label review and linking to its verification tool.",
      fit: "cover",
      height: 800,
      kind: "screenshot",
      mobile: { height: 360, src: "/images/projects/compliance-label-assistant-mobile.webp", width: 480 },
      src: "/images/projects/compliance-label-assistant-concept.webp",
      width: 1280
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
    badge: { label: "Live site", tone: "live" },
    preview: {
      alt: "NotePal homepage with its study tools introduction and Enter NotePal action.",
      fit: "cover",
      height: 795,
      kind: "screenshot",
      mobile: { height: 354, src: "/images/projects/notepal-mobile.webp", width: 472 },
      src: "/images/projects/notepal-concept.webp",
      width: 1272
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
    badge: { label: "Live site", tone: "live" },
    preview: {
      alt: "Tergion Technologies homepage introducing business systems and an example lead-to-CRM workflow.",
      fit: "cover",
      height: 800,
      kind: "screenshot",
      mobile: { height: 360, src: "/images/projects/tergion-technologies-mobile.webp", width: 480 },
      src: "/images/projects/tergion-technologies-concept.webp",
      width: 1280
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
    badge: { label: "Scheduled", tone: "scheduled" },
    preview: {
      fallback: {
        alt: "LeetNotes sheet-to-files preview with the selected Two Sum row and generated study files.",
        src: "/images/projects/leetnotes-concept.webp"
      },
      height: 561,
      kind: "leetnotes",
      width: 896
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
    badge: { label: "Installable", tone: "installable" },
    preview: {
      alt: "Clair desktop file organizer showing category and extension checkboxes with reusable presets.",
      fit: "contain",
      height: 463,
      kind: "screenshot",
      src: "/images/projects/clair-concept.webp",
      width: 793
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
