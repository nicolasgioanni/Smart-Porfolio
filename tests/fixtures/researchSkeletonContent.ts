import type { ResearchItem } from "../../src/content/types";

type ResearchSkeletonFixture = {
  items: readonly ResearchItem[];
  name: string;
  resourceCounts: readonly number[];
};

function createResearchItem(
  id: ResearchItem["id"],
  links: ResearchItem["links"],
  pendingLinks: string[] = []
): ResearchItem {
  return {
    id,
    title:
      id === "cytocv-miller-lab"
        ? "CytoCV: Computer vision for microscopy"
        : id === "adversarial-machine-learning"
          ? "Adversarial Machine Learning"
          : "Guide Donor Scheduler: CRISPR design automation",
    bullets: [],
    skills: [],
    links,
    pendingLinks,
    detailOrder:
      id === "cytocv-miller-lab" ? 1 : id === "adversarial-machine-learning" ? 2 : 3,
    featured: true,
    showOnHome: true
  };
}

export const researchSkeletonFixtures = [
  {
    name: "template content",
    resourceCounts: [4, 3, 1],
    items: [
      createResearchItem(
        "cytocv-miller-lab",
        [
          { label: "Live site", url: "https://example.com/live" },
          { label: "Source code", url: "https://example.com/source" },
          { label: "Software DOI", url: "https://example.com/doi" }
        ],
        ["Manuscript", " manuscript ", "Source code"]
      ),
      createResearchItem("adversarial-machine-learning", [
        { label: "Source code", url: "https://example.com/source" },
        { label: "Manuscript", url: "https://example.com/manuscript" },
        { label: "Reference DOI", url: "https://example.com/doi" }
      ]),
      createResearchItem("yeast-dna-target-selection", [
        { label: "Source code", url: "https://example.com/source" }
      ])
    ]
  },
  {
    name: "production workbook content",
    resourceCounts: [3, 2, 1],
    items: [
      createResearchItem("cytocv-miller-lab", [
        { label: "Live site", url: "https://example.com/live" },
        { label: "Source code", url: "https://example.com/source" },
        { label: "Software DOI", url: "https://example.com/doi" }
      ]),
      createResearchItem("adversarial-machine-learning", [
        { label: "Source code", url: "https://example.com/source" },
        { label: "Manuscript", url: "https://example.com/manuscript" }
      ]),
      createResearchItem("yeast-dna-target-selection", [
        { label: "Source code", url: "https://example.com/source" }
      ])
    ]
  }
] as const satisfies readonly ResearchSkeletonFixture[];
