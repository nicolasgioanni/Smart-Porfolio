export type ProjectDiagramNode = { label: string; role: string; slot: 0 | 1 | 2 | 3 | 4 | 5 };
export type ProjectDiagramEdge = { bidirectional?: boolean; from: ProjectDiagramNode["slot"]; to: ProjectDiagramNode["slot"] };
export type ProjectAttribution = {
  link: { label: string; url: string };
  prefix: string;
  suffix: string;
};
export type ProjectDiagram = { description: string; edges: readonly ProjectDiagramEdge[]; nodes: readonly ProjectDiagramNode[]; title: string };
export type ProjectPreviewMobileAsset = { height: number; src: string; width: number };
export type ProjectPreview =
  | { alt: string; fit: "contain" | "cover"; height: number; kind: "screenshot"; mobile?: ProjectPreviewMobileAsset; src: string; width: number }
  | { fallback: { alt: string; src: string }; height: number; kind: "leetnotes"; width: number };
export type ProjectPreviewBadge = { label: "Live site" | "Installable" | "Scheduled"; tone: "installable" | "live" | "scheduled" };
export type ProjectVisual = { attribution?: ProjectAttribution; badge?: ProjectPreviewBadge; diagram: ProjectDiagram; preview: ProjectPreview };

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
      description: "The reviewer workspace sends artwork and expected fields to the FastAPI verification API. The API prepares the image, OpenAI extracts visible fields, and deterministic rules compare those fields with the expected values. The workspace presents the results for human review and export.",
      edges: [{ from: 0, to: 1 }, { from: 1, to: 3 }, { from: 3, to: 2 }, { from: 2, to: 4 }, { from: 4, to: 5 }],
      nodes: [
        { label: "Workspace", role: "React UI", slot: 0 },
        { label: "Verify API", role: "FastAPI", slot: 1 },
        { label: "Image prep", role: "Validation", slot: 3 },
        { label: "Extraction", role: "OpenAI", slot: 2 },
        { label: "Rule checks", role: "Comparison", slot: 4 },
        { label: "Export", role: "React UI", slot: 5 }
      ],
      title: "Compliance Label Assistant architecture"
    }
  },
  notepal: {
    attribution: {
      link: { label: "Parth Gupta", url: "https://www.linkedin.com/in/parthgu/" },
      prefix: "Co-developed with ",
      suffix: "."
    },
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
      description: "The student uses the study workspace, which calls Next.js server routes. The server reads and writes study data in Firestore, uses OpenAI for generation and embeddings, and queries Pinecone for document-scoped retrieval. A separate media-processing prototype is also present in the repository.",
      edges: [{ from: 0, to: 1 }, { bidirectional: true, from: 1, to: 3 }, { bidirectional: true, from: 3, to: 2 }, { bidirectional: true, from: 3, to: 5 }, { bidirectional: true, from: 3, to: 4 }],
      nodes: [
        { label: "Student", role: "Browser", slot: 0 },
        { label: "Workspace", role: "Next.js UI", slot: 1 },
        { label: "Firestore", role: "Study data", slot: 2 },
        { label: "API routes", role: "Next.js", slot: 3 },
        { label: "Pinecone", role: "Retrieval", slot: 4 },
        { label: "OpenAI", role: "Generation", slot: 5 }
      ],
      title: "NotePal architecture"
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
      description: "The Next.js website sends inquiries to a lead API running on Cloudflare. The API verifies Turnstile tokens, uses Upstash Redis for rate limiting and duplicate reservation, sends leads to GoHighLevel, and sends confirmation email through a configured provider.",
      edges: [{ from: 1, to: 3 }, { from: 3, to: 2 }, { bidirectional: true, from: 3, to: 5 }, { from: 3, to: 4 }, { from: 3, to: 0 }],
      nodes: [
        { label: "Email", role: "Delivery", slot: 0 },
        { label: "Website", role: "Next.js", slot: 1 },
        { label: "Turnstile", role: "Verification", slot: 2 },
        { label: "Lead API", role: "Cloudflare", slot: 3 },
        { label: "CRM", role: "GoHighLevel", slot: 4 },
        { label: "Redis", role: "Upstash", slot: 5 }
      ],
      title: "Tergion Technologies architecture"
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
      description: "GitHub Actions runs the Python sync CLI on a schedule. The CLI downloads Google Sheets CSV data, resolves problem IDs through LeetCode GraphQL, and generates Markdown notes, indexes, and solution files. Actions commits the generated outputs to the repository.",
      edges: [{ from: 0, to: 3 }, { from: 1, to: 3 }, { bidirectional: true, from: 3, to: 2 }, { from: 3, to: 4 }, { from: 3, to: 5 }],
      nodes: [
        { label: "Actions", role: "GitHub", slot: 0 },
        { label: "Sheets", role: "Google", slot: 1 },
        { label: "LeetCode", role: "GraphQL", slot: 2 },
        { label: "Sync CLI", role: "Python", slot: 3 },
        { label: "Notes", role: "Markdown", slot: 4 },
        { label: "Solutions", role: "Files", slot: 5 }
      ],
      title: "LeetNotes architecture"
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
      description: "The Qt desktop interface loads and saves JSON configuration and starts the Python organizer. The organizer scans a selected folder, applies the configured extension categories, and moves files into category folders.",
      edges: [{ bidirectional: true, from: 1, to: 0 }, { from: 1, to: 3 }, { from: 0, to: 3 }, { from: 2, to: 3 }, { from: 3, to: 5 }],
      nodes: [
        { label: "Presets", role: "JSON", slot: 0 },
        { label: "Desktop", role: "Qt UI", slot: 1 },
        { label: "Input", role: "Folder", slot: 2 },
        { label: "Organizer", role: "Python", slot: 3 },
        { label: "Output", role: "Folders", slot: 5 }
      ],
      title: "Clair architecture"
    }
  }
} as const satisfies Record<string, ProjectVisual>;

export function getProjectVisual(id: string): ProjectVisual | undefined {
  return Object.hasOwn(projectVisualRegistry, id) ? projectVisualRegistry[id as keyof typeof projectVisualRegistry] : undefined;
}
