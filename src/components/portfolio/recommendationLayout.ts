export const defaultRecommendationPreviewLines = 4;
export const balancedRecommendationPreviewLines = 3;

const rowTopTolerance = 2;

export type HomeRecommendationMetric = {
  canReducePreview: boolean;
  headerHeight: number;
  id: string;
  naturalCollapsedHeightAtFourLines: number;
  quoteLineHeight: number;
  top: number;
};

export type HomeRecommendationLayout = {
  collapsedLineCount: typeof defaultRecommendationPreviewLines | typeof balancedRecommendationPreviewLines;
  collapsedMinHeight: number;
};

export type HomeRecommendationOverflowLayout = {
  panelHeight: number;
  reserveHeight: number;
};

function groupMetricsByVisualRow(metrics: HomeRecommendationMetric[]): HomeRecommendationMetric[][] {
  const rows: HomeRecommendationMetric[][] = [];

  for (const metric of [...metrics].sort((left, right) => left.top - right.top)) {
    const matchingRow = rows.find((row) => Math.abs((row[0]?.top ?? metric.top) - metric.top) <= rowTopTolerance);

    if (matchingRow) {
      matchingRow.push(metric);
    } else {
      rows.push([metric]);
    }
  }

  return rows;
}

export function calculateHomeRecommendationLayout(
  metrics: HomeRecommendationMetric[]
): Record<string, HomeRecommendationLayout> {
  const layout: Record<string, HomeRecommendationLayout> = {};

  for (const row of groupMetricsByVisualRow(metrics)) {
    const shortestHeaderHeight = Math.min(...row.map((metric) => metric.headerHeight));
    const rowItems = row.map((metric) => {
      const headerHeightDelta = Math.max(0, metric.headerHeight - shortestHeaderHeight);
      const occupiesExtraHeaderLine =
        row.length > 1 && Math.round(headerHeightDelta / Math.max(1, metric.quoteLineHeight)) >= 1;
      const collapsedLineCount: HomeRecommendationLayout["collapsedLineCount"] =
        occupiesExtraHeaderLine && metric.canReducePreview
          ? balancedRecommendationPreviewLines
          : defaultRecommendationPreviewLines;
      const balancedNaturalHeight =
        metric.naturalCollapsedHeightAtFourLines -
        (defaultRecommendationPreviewLines - collapsedLineCount) * metric.quoteLineHeight;

      return {
        collapsedLineCount,
        id: metric.id,
        naturalHeight: Math.max(0, balancedNaturalHeight)
      };
    });
    const collapsedMinHeight = Math.ceil(Math.max(...rowItems.map((item) => item.naturalHeight)));

    for (const item of rowItems) {
      layout[item.id] = {
        collapsedLineCount: item.collapsedLineCount,
        collapsedMinHeight
      };
    }
  }

  return layout;
}

export function calculateHomeRecommendationCollapsedGridHeight(
  metrics: HomeRecommendationMetric[],
  layout: Record<string, HomeRecommendationLayout>,
  rowGap: number
): number {
  const rows = groupMetricsByVisualRow(metrics);

  if (rows.length === 0) return 0;

  const rowsHeight = rows.reduce((totalHeight, row) => {
    const rowHeight = Math.max(...row.map((metric) => layout[metric.id]?.collapsedMinHeight ?? 0));
    return totalHeight + rowHeight;
  }, 0);

  return Math.ceil(rowsHeight + Math.max(0, rowGap) * Math.max(0, rows.length - 1));
}

export function calculateHomeRecommendationOverflowLayout({
  actualContentHeight,
  collapsedContentHeight,
  headerHeight,
  headerMarginBottom,
  surfaceFrameHeight
}: {
  actualContentHeight: number;
  collapsedContentHeight: number;
  headerHeight: number;
  headerMarginBottom: number;
  surfaceFrameHeight: number;
}): HomeRecommendationOverflowLayout {
  return {
    panelHeight: Math.ceil(
      Math.max(0, surfaceFrameHeight) +
        Math.max(0, headerHeight) +
        Math.max(0, headerMarginBottom) +
        Math.max(0, collapsedContentHeight)
    ),
    reserveHeight: Math.ceil(Math.max(0, actualContentHeight - collapsedContentHeight))
  };
}
