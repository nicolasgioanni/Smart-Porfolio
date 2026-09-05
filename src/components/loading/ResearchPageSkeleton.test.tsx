import { render } from "@testing-library/react";
import type { ResearchItem } from "@/content/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalResearchSkeletonItems, researchSkeletonFixtures } from "../../../tests/fixtures/researchSkeletonContent";

const researchContentFixture = vi.hoisted(() => ({
  items: [] as ResearchItem[]
}));

vi.mock("@/lib/content/getPortfolioContent", () => ({
  getPortfolioContent: () => ({ research: researchContentFixture.items })
}));

import { ResearchPageSkeleton } from "@/components/loading/ResearchPageSkeleton";

function getResourceCounts(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll(".research-skeleton__resources")).map(
    (resources) => resources.querySelectorAll(":scope > .skeleton-block").length
  );
}

function getMediaTitleCounts(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll(".research-skeleton__project")).map(
    (project) => project.querySelectorAll(".research-skeleton__media-title").length
  );
}

describe("ResearchPageSkeleton", () => {
  afterEach(() => {
    researchContentFixture.items = [];
  });

  for (const { name, items, resourceCounts } of researchSkeletonFixtures) {
    it(`matches ${name} visible resource controls`, () => {
      researchContentFixture.items = [...items];
      const { container } = render(<ResearchPageSkeleton />);

      expect(getResourceCounts(container)).toEqual(resourceCounts);
    });
  }

  it("uses explicit detail content for isolated renders without changing generated-content alignment", () => {
    const productionFixture = researchSkeletonFixtures[1];

    researchContentFixture.items = [...productionFixture.items];
    const defaultRender = render(<ResearchPageSkeleton />);
    const isolatedRender = render(<ResearchPageSkeleton detailItems={canonicalResearchSkeletonItems} />);

    expect(getResourceCounts(defaultRender.container)).toEqual(productionFixture.resourceCounts);
    expect(getResourceCounts(isolatedRender.container)).toEqual(researchSkeletonFixtures[0].resourceCounts);
  });

  it("keeps canonical graphical abstract frames noninteractive", () => {
    const { container } = render(<ResearchPageSkeleton detailItems={canonicalResearchSkeletonItems} />);
    const frames = Array.from(container.querySelectorAll<HTMLElement>(".research-skeleton__abstract-frame"));

    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      expect(frame.closest(".research-skeleton__abstract")).not.toBeNull();
      expect(frame.querySelectorAll("a, button, input, select, textarea")).toHaveLength(0);
    }
  });

  it("uses noninteractive title placeholders for every resolved research medium", () => {
    const { container } = render(<ResearchPageSkeleton detailItems={canonicalResearchSkeletonItems} />);

    expect(getMediaTitleCounts(container)).toEqual([2, 1, 1]);
    expect(container.querySelectorAll(".research-skeleton__media-title a, .research-skeleton__media-title button")).toHaveLength(0);
  });
});
