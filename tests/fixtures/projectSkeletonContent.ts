import type { ProjectItem } from "../../src/content/types";

const projectSkeletonSpecs = [
  ["compliance-label-assistant", "Live demo"],
  ["notepal", "Live demo"],
  ["tergion-technologies", "Live demo"],
  ["leetnotes", null],
  ["clair", "Download"]
] as const;

export const canonicalProjectSkeletonItems: readonly ProjectItem[] = projectSkeletonSpecs.map(([id, secondaryAction], index) => ({
  detailOrder: index + 1,
  featured: false,
  homeOrder: index + 1,
  homeSkills: [],
  id,
  image: `/images/projects/${id}-concept.webp`,
  links: secondaryAction
    ? [
        { label: "Source code", url: `https://github.com/example/${id}` },
        { label: secondaryAction, url: secondaryAction === "Download" ? `https://github.com/example/${id}/releases/latest` : `https://example.com/${id}` }
      ]
    : [{ label: "Source code", url: `https://github.com/example/${id}` }],
  showOnHome: index < 3,
  stack: [],
  title: `Project ${index + 1}`
}));

export const canonicalHomeProjectSkeletonItems = canonicalProjectSkeletonItems.slice(0, 3);
