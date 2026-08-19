import { describe, expect, it } from "vitest";
import {
  calculateHomeRecommendationLayout,
  type HomeRecommendationMetric
} from "@/components/portfolio/recommendationLayout";

function createMetric(
  id: string,
  overrides: Partial<Omit<HomeRecommendationMetric, "id">> = {}
): HomeRecommendationMetric {
  return {
    canReducePreview: true,
    headerHeight: 90,
    id,
    naturalCollapsedHeightAtFourLines: 350,
    quoteLineHeight: 24,
    top: 0,
    ...overrides
  };
}

describe("Home recommendation row layout", () => {
  it("reduces a taller desktop header to three lines and gives the row one collapsed height", () => {
    const layout = calculateHomeRecommendationLayout([
      createMetric("brent"),
      createMetric("annuska"),
      createMetric("anoop", {
        headerHeight: 111,
        naturalCollapsedHeightAtFourLines: 371
      })
    ]);

    expect(Object.values(layout).map((item) => item.collapsedLineCount)).toEqual([4, 4, 3]);
    expect(Object.values(layout).map((item) => item.collapsedMinHeight)).toEqual([350, 350, 350]);
  });

  it("keeps remainder and single-column rows at four lines", () => {
    const twoColumnLayout = calculateHomeRecommendationLayout([
      createMetric("brent"),
      createMetric("annuska"),
      createMetric("anoop", {
        headerHeight: 111,
        naturalCollapsedHeightAtFourLines: 371,
        top: 390
      })
    ]);
    const singleColumnLayout = calculateHomeRecommendationLayout([
      createMetric("brent"),
      createMetric("annuska", { top: 390 }),
      createMetric("anoop", {
        headerHeight: 111,
        naturalCollapsedHeightAtFourLines: 371,
        top: 780
      })
    ]);

    expect(Object.values(twoColumnLayout).map((item) => item.collapsedLineCount)).toEqual([4, 4, 4]);
    expect(Object.values(singleColumnLayout).map((item) => item.collapsedLineCount)).toEqual([4, 4, 4]);
  });

  it("does not shorten a quote that already fits within four lines", () => {
    const layout = calculateHomeRecommendationLayout([
      createMetric("baseline"),
      createMetric("short", {
        canReducePreview: false,
        headerHeight: 114,
        naturalCollapsedHeightAtFourLines: 300
      })
    ]);

    expect(layout.short?.collapsedLineCount).toBe(4);
  });
});
