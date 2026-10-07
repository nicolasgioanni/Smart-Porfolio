import type { ProjectItem } from "../../src/content/types";

const projectSkeletonSpecs = [
  ["compliance-label-assistant", 2],
  ["notepal", 2],
  ["tergion-technologies", 2],
  ["leetnotes", 1],
  ["clair", 1]
] as const;

export const canonicalProjectSkeletonItems: readonly ProjectItem[] = projectSkeletonSpecs.map(([id, actionCount], index) => ({
  detailOrder: index + 1,
  featured: false,
  homeOrder: index + 1,
  homeSkills: [],
  id,
  image: `/images/projects/${id}-concept.webp`,
  links: actionCount === 2
    ? [
        { label: "Source code", url: `https://github.com/example/${id}` },
        { label: "Live demo", url: `https://example.com/${id}` }
      ]
    : [{ label: "Source code", url: `https://github.com/example/${id}` }],
  showOnHome: index < 3,
  stack: [],
  title: `Project ${index + 1}`
}));

export const canonicalHomeProjectSkeletonItems = canonicalProjectSkeletonItems.slice(0, 3);
