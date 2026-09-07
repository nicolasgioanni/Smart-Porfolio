import { describe, expect, it } from "vitest";
import { getResearchGraphicalAbstract } from "@/lib/content/researchGraphicalAbstracts";

describe("getResearchGraphicalAbstract", () => {
  it.each([
    ["cytocv-miller-lab", "/images/research/cytocv-graphical-abstract.png", "CytoCV Graphical Abstract", 1672, 941],
    ["adversarial-machine-learning", "/images/research/independent-study-graphical-abstract.png", "AML Graphical Abstract", 3840, 2160],
    ["yeast-dna-target-selection", "/images/research/guide-donor-scheduler-graphical-abstract.png", "GuideDonorScheduler Graphical Abstract", 3840, 2160]
  ])("resolves the curated %s abstract", (id, src, displayTitle, width, height) => {
    expect(getResearchGraphicalAbstract({ id })).toMatchObject({
      displayTitle,
      height,
      source: "curated",
      src,
      width
    });
  });

  it("prefers a complete canonical pair without reusing stale curated dimensions", () => {
    expect(
      getResearchGraphicalAbstract({
        graphicalAbstract: "/images/research/revised-cytocv.webp",
        graphicalAbstractAlt: " Revised CytoCV workflow. ",
        id: "cytocv-miller-lab"
      })
    ).toEqual({
      alt: "Revised CytoCV workflow.",
      displayTitle: "CytoCV Graphical Abstract",
      source: "canonical",
      src: "/images/research/revised-cytocv.webp"
    });
  });

  it("retains intrinsic dimensions when canonical content selects the curated file", () => {
    expect(
      getResearchGraphicalAbstract({
        graphicalAbstract: "/images/research/cytocv-graphical-abstract.png",
        graphicalAbstractAlt: "Canonical CytoCV workflow.",
        id: "cytocv-miller-lab"
      })
    ).toEqual({
      alt: "Canonical CytoCV workflow.",
      displayTitle: "CytoCV Graphical Abstract",
      height: 941,
      source: "canonical",
      src: "/images/research/cytocv-graphical-abstract.png",
      width: 1672
    });
  });

  it("uses a neutral display title for an unfamiliar valid canonical abstract", () => {
    expect(
      getResearchGraphicalAbstract({
        graphicalAbstract: "/images/research/future-system.png",
        graphicalAbstractAlt: "A future research workflow.",
        id: "future-research-system"
      })
    ).toEqual({
      alt: "A future research workflow.",
      displayTitle: "Graphical Abstract",
      source: "canonical",
      src: "/images/research/future-system.png"
    });
  });

  it("does not mask an incomplete canonical pair with a curated fallback", () => {
    expect(
      getResearchGraphicalAbstract({
        graphicalAbstract: "/images/research/incomplete.png",
        id: "cytocv-miller-lab"
      })
    ).toBeUndefined();
    expect(
      getResearchGraphicalAbstract({
        graphicalAbstractAlt: "Incomplete alternative text.",
        id: "cytocv-miller-lab"
      })
    ).toBeUndefined();
    expect(getResearchGraphicalAbstract({ graphicalAbstract: "/images/research/incomplete.png", id: "unknown" })).toBeUndefined();
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
    "does not resolve an inherited registry key for %s",
    (id) => {
      expect(getResearchGraphicalAbstract({ id })).toBeUndefined();
    }
  );

  it.each([
    "https://example.test/abstract.png",
    "//example.test/abstract.png",
    "images/research/abstract.png",
    "/images/other/abstract.png",
    "/images/research/../abstract.png",
    "/images/research/%2e%2e/abstract.png",
    "/images/research/%252e%252e%252fabstract.png",
    "/images/research/abstract.png?revision=1",
    "/images/research/abstract.png#figure",
    "/images/research/abstract\\preview.png",
    "/images/research/abstract%5cpreview.png",
    "/images/research/abstract%255cpreview.png",
    "/images/research/abstract\0preview.png",
    "/images/research/abstract%00preview.png",
    "/images/research/abstract%2500preview.png",
    " /images/research/abstract.png",
    "/images/research/abstract.png ",
    "/images/research/abstract image.png",
    "/images/research/abstract.svg"
  ])("rejects an unsafe canonical path without falling back: %s", (graphicalAbstract) => {
    expect(
      getResearchGraphicalAbstract({
        graphicalAbstract,
        graphicalAbstractAlt: "A complete description.",
        id: "cytocv-miller-lab"
      })
    ).toBeUndefined();
  });

  it("rejects whitespace-only canonical input without falling back", () => {
    expect(
      getResearchGraphicalAbstract({
        graphicalAbstractAlt: " ",
        id: "cytocv-miller-lab"
      })
    ).toBeUndefined();
    expect(
      getResearchGraphicalAbstract({
        graphicalAbstract: " ",
        id: "cytocv-miller-lab"
      })
    ).toBeUndefined();
  });
});
