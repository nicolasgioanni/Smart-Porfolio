import { describe, expect, it } from "vitest";
import {
  calculateHomeRecommendationCollapsedGridHeight,
  calculateHomeRecommendationLayout,
  calculateHomeRecommendationOverflowLayout,
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

  it("calculates the collapsed grid height for desktop and responsive rows", () => {
    const desktopMetrics = [
      createMetric("brent"),
      createMetric("annuska"),
      createMetric("anoop", {
        headerHeight: 111,
        naturalCollapsedHeightAtFourLines: 371
      })
    ];
    const twoColumnMetrics = desktopMetrics.map((metric, index) => ({
      ...metric,
      top: index === 2 ? 390 : 0
    }));
    const singleColumnMetrics = desktopMetrics.map((metric, index) => ({
      ...metric,
      top: index * 390
    }));

    const desktopLayout = calculateHomeRecommendationLayout(desktopMetrics);
    const twoColumnLayout = calculateHomeRecommendationLayout(twoColumnMetrics);
    const singleColumnLayout = calculateHomeRecommendationLayout(singleColumnMetrics);

    expect(calculateHomeRecommendationCollapsedGridHeight(desktopMetrics, desktopLayout, 24)).toBe(350);
    expect(calculateHomeRecommendationCollapsedGridHeight(twoColumnMetrics, twoColumnLayout, 24)).toBe(745);
    expect(calculateHomeRecommendationCollapsedGridHeight(singleColumnMetrics, singleColumnLayout, 24)).toBe(1119);
  });

  it("keeps the panel at its collapsed height and reserves only real overflow", () => {
    expect(
      calculateHomeRecommendationOverflowLayout({
        actualContentHeight: 510,
        collapsedContentHeight: 350,
        headerHeight: 44,
        headerMarginBottom: 20,
        surfaceFrameHeight: 82
      })
    ).toEqual({
      panelHeight: 496,
      reserveHeight: 160
    });

    expect(
      calculateHomeRecommendationOverflowLayout({
        actualContentHeight: 340,
        collapsedContentHeight: 350,
        headerHeight: 44,
        headerMarginBottom: 20,
        surfaceFrameHeight: 82
      }).reserveHeight
    ).toBe(0);
  });
});
