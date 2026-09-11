import { render } from "@testing-library/react";
import type { ResearchItem } from "@/content/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { researchSkeletonFixtures } from "../../../tests/fixtures/researchSkeletonContent";

const researchContentFixture = vi.hoisted(() => ({
  items: [] as ResearchItem[]
}));

vi.mock("@/lib/content/getPortfolioContent", () => ({
  getPortfolioContent: () => ({ research: researchContentFixture.items })
}));

import { ResearchPageSkeleton } from "@/components/loading/ResearchPageSkeleton";

describe("ResearchPageSkeleton", () => {
  afterEach(() => {
    researchContentFixture.items = [];
  });

  for (const { name, items, resourceCounts } of researchSkeletonFixtures) {
    it(`matches ${name} visible resource controls`, () => {
      researchContentFixture.items = [...items];
      const { container } = render(<ResearchPageSkeleton />);

      expect(
        Array.from(container.querySelectorAll(".research-skeleton__resources")).map(
          (resources) => resources.querySelectorAll(":scope > .skeleton-block").length
        )
      ).toEqual(resourceCounts);
    });
  }
});
