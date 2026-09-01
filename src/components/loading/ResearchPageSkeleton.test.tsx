import { render } from "@testing-library/react";
import type { ResearchItem } from "@/content/types";
import { afterEach, describe, expect, it, vi } from "vitest";

const researchContentFixture = vi.hoisted(() => ({
  items: [] as ResearchItem[]
}));

vi.mock("@/lib/content/getPortfolioContent", () => ({
  getPortfolioContent: () => ({ research: researchContentFixture.items })
}));

import { ResearchPageSkeleton } from "@/components/loading/ResearchPageSkeleton";

function createResearchItem(
  id: ResearchItem["id"],
  links: ResearchItem["links"],
  pendingLinks: string[] = []
): ResearchItem {
  return {
    id,
    title: id,
    bullets: [],
    skills: [],
    links,
    pendingLinks,
    featured: true,
    showOnHome: true
  };
}

const templateResearch = [
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
];

const productionResearch = [
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
];

describe("ResearchPageSkeleton", () => {
  afterEach(() => {
    researchContentFixture.items = [];
  });

  for (const { name, items, resourceCounts } of [
    { name: "template content", items: templateResearch, resourceCounts: [4, 3, 1] },
    { name: "production workbook content", items: productionResearch, resourceCounts: [3, 2, 1] }
  ]) {
    it(`matches ${name} visible resource controls`, () => {
      researchContentFixture.items = items;
      const { container } = render(<ResearchPageSkeleton />);

      expect(
        Array.from(container.querySelectorAll(".research-skeleton__resources")).map(
          (resources) => resources.querySelectorAll(":scope > .skeleton-block").length
        )
      ).toEqual(resourceCounts);
    });
  }
});
