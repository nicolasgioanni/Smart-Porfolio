"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RecommendationItem } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { RecommendationCard } from "@/components/portfolio/RecommendationCard";
import {
  MOBILE_UI_QUERY,
  PHONE_HERO_QUERY,
  useMediaQuery
} from "@/components/responsive/useMediaQuery";
import {
  calculateHomeRecommendationCollapsedGridHeight,
  calculateHomeRecommendationLayout,
  calculateHomeRecommendationOverflowLayout,
  defaultRecommendationPreviewLines,
  type HomeRecommendationLayout,
  type HomeRecommendationMetric
} from "@/components/portfolio/recommendationLayout";

const fallbackQuoteLineHeight = 22;
const fallbackToggleHeight = 36;

type RecommendationItemStyle = CSSProperties & {
  "--recommendation-row-collapsed-height"?: string;
};

const overflowLayoutAttribute = "recommendationOverflowLayout";
const panelHeightProperty = "--home-recommendations-panel-height";
const reserveHeightProperty = "--home-recommendations-overflow-reserve";

function parsePixelValue(value: string): number {
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getRenderedHeight(element: HTMLElement | null, fallback = 0): number {
  if (!element) return fallback;

  if (element.offsetHeight > 0) return element.offsetHeight;

  const rectHeight = element.getBoundingClientRect().height;

  if (rectHeight > 0) return rectHeight;

  const computedStyle = window.getComputedStyle(element);
  return Math.max(
    parsePixelValue(computedStyle.height),
    parsePixelValue(computedStyle.minHeight),
    fallback
  );
}

function getLineHeight(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element);
  const parsedLineHeight = parsePixelValue(computedStyle.lineHeight);

  if (parsedLineHeight > 0) return parsedLineHeight;

  const parsedFontSize = parsePixelValue(computedStyle.fontSize);
  return parsedFontSize > 0 ? parsedFontSize * 1.5 : fallbackQuoteLineHeight;
}

function getGridRowGap(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element);
  return parsePixelValue(computedStyle.rowGap) || parsePixelValue(computedStyle.gap);
}

function getDirectChildByClassName(element: HTMLElement, className: string): HTMLElement | null {
  return (
    Array.from(element.children).find(
      (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains(className)
    ) ?? null
  );
}

function setPixelCustomProperty(element: HTMLElement, property: string, value: number) {
  const nextValue = `${Math.max(0, Math.ceil(value))}px`;

  if (element.style.getPropertyValue(property) !== nextValue) {
    element.style.setProperty(property, nextValue);
  }
}

function clearRecommendationOverflowLayout(grid: HTMLElement) {
  const section = grid.closest<HTMLElement>(".home-section--recommendations");

  if (!section) return;

  delete section.dataset[overflowLayoutAttribute];
  section.style.removeProperty(panelHeightProperty);
  section.style.removeProperty(reserveHeightProperty);
}

function applyRecommendationOverflowLayout(
  grid: HTMLElement,
  metrics: HomeRecommendationMetric[],
  layout: Record<string, HomeRecommendationLayout>
) {
  const homeRecommendations = grid.parentElement;
  const section = grid.closest<HTMLElement>(".home-section--recommendations");
  const surface = section ? getDirectChildByClassName(section, "home-section__surface") : null;
  const sectionHeader = surface?.querySelector<HTMLElement>(".home-section__header") ?? null;

  if (!homeRecommendations || !section || !surface || !sectionHeader) return;

  const collapsedGridHeight = calculateHomeRecommendationCollapsedGridHeight(
    metrics,
    layout,
    getGridRowGap(grid)
  );

  if (collapsedGridHeight <= 0) return;

  const actions = getDirectChildByClassName(homeRecommendations, "home-recommendations__actions");
  const collapsedContentHeight =
    collapsedGridHeight +
    (actions ? getGridRowGap(homeRecommendations) + getRenderedHeight(actions) : 0);
  const surfaceStyle = window.getComputedStyle(surface);
  const headerStyle = window.getComputedStyle(sectionHeader);
  const surfaceFrameHeight =
    parsePixelValue(surfaceStyle.paddingTop) +
    parsePixelValue(surfaceStyle.paddingBottom) +
    parsePixelValue(surfaceStyle.borderTopWidth) +
    parsePixelValue(surfaceStyle.borderBottomWidth);
  const overflowLayout = calculateHomeRecommendationOverflowLayout({
    actualContentHeight: getRenderedHeight(homeRecommendations, collapsedContentHeight),
    collapsedContentHeight,
    headerHeight: getRenderedHeight(sectionHeader),
    headerMarginBottom: parsePixelValue(headerStyle.marginBottom),
    surfaceFrameHeight
  });

  if (overflowLayout.panelHeight <= 0) return;

  setPixelCustomProperty(section, panelHeightProperty, overflowLayout.panelHeight);
  setPixelCustomProperty(section, reserveHeightProperty, overflowLayout.reserveHeight);
  section.dataset[overflowLayoutAttribute] = "ready";
}

function measureRecommendationMetric(wrapper: HTMLElement): HomeRecommendationMetric | null {
  const id = wrapper.dataset.recommendationId;
  const card = wrapper.querySelector<HTMLElement>(".recommendation-card--summary");
  const header = card?.querySelector<HTMLElement>(".recommendation-card__header");
  const expandable = card?.querySelector<HTMLElement>(".recommendation-expandable");
  const quote = expandable?.querySelector<HTMLElement>(".recommendation-expandable__quote");

  if (!id || !card || !header || !expandable || !quote) return null;

  const headerHeight = getRenderedHeight(header);
  const quoteLineHeight = getLineHeight(quote);
  const quoteNaturalHeight = Math.max(quote.scrollHeight, quote.getBoundingClientRect().height);

  if (headerHeight <= 0 || quoteNaturalHeight <= 0 || quoteLineHeight <= 0) return null;

  const fourLineQuoteHeight = defaultRecommendationPreviewLines * quoteLineHeight;
  const canReducePreview = quoteNaturalHeight > fourLineQuoteHeight + 1;
  const previewHeightAtFourLines = Math.min(quoteNaturalHeight, fourLineQuoteHeight);
  const cardStyle = window.getComputedStyle(card);
  const cardBoxHeight =
    parsePixelValue(cardStyle.paddingTop) +
    parsePixelValue(cardStyle.paddingBottom) +
    parsePixelValue(cardStyle.borderTopWidth) +
    parsePixelValue(cardStyle.borderBottomWidth);
  const cardChildren = Array.from(card.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  );
  const cardChildrenHeight = cardChildren.reduce((totalHeight, child) => {
    if (child !== expandable) return totalHeight + getRenderedHeight(child);

    const toggle = expandable.querySelector<HTMLElement>(".recommendation-expandable__toggle");
    const expandableControlsHeight = canReducePreview
      ? getGridRowGap(expandable) + getRenderedHeight(toggle, fallbackToggleHeight)
      : 0;

    return totalHeight + previewHeightAtFourLines + expandableControlsHeight;
  }, 0);
  const cardGapsHeight = Math.max(0, cardChildren.length - 1) * getGridRowGap(card);

  return {
    canReducePreview,
    headerHeight,
    id,
    naturalCollapsedHeightAtFourLines: cardBoxHeight + cardChildrenHeight + cardGapsHeight,
    quoteLineHeight,
    top: wrapper.offsetParent ? wrapper.offsetTop : wrapper.getBoundingClientRect().top
  };
}

function layoutsMatch(
  currentLayout: Record<string, HomeRecommendationLayout>,
  nextLayout: Record<string, HomeRecommendationLayout>
): boolean {
  const currentIds = Object.keys(currentLayout);
  const nextIds = Object.keys(nextLayout);

  if (currentIds.length !== nextIds.length) return false;

  return nextIds.every((id) => {
    const currentItem = currentLayout[id];
    const nextItem = nextLayout[id];

    return (
      currentItem?.collapsedLineCount === nextItem?.collapsedLineCount &&
      currentItem?.collapsedMinHeight === nextItem?.collapsedMinHeight
    );
  });
}

export function HomeRecommendations({ items, showAction = true }: { items: RecommendationItem[]; showAction?: boolean }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const scheduledFrameRef = useRef<number>();
  const [layout, setLayout] = useState<Record<string, HomeRecommendationLayout>>({});
  const layoutRef = useRef<Record<string, HomeRecommendationLayout>>({});
  const usesNaturalFlow = useMediaQuery(MOBILE_UI_QUERY);
  const usesSingleColumnLayout = useMediaQuery(PHONE_HERO_QUERY);
  const itemSignature = useMemo(() => items.map((item) => item.id).join("|"), [items]);

  const measureLayout = useCallback(() => {
    const grid = gridRef.current;

    if (!grid) return;

    if (usesNaturalFlow) {
      clearRecommendationOverflowLayout(grid);
    }

    if (usesSingleColumnLayout) {
      if (Object.keys(layoutRef.current).length > 0) {
        layoutRef.current = {};
        setLayout({});
      }

      return;
    }

    const metrics = Array.from(grid.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement)
      .map(measureRecommendationMetric)
      .filter((metric): metric is HomeRecommendationMetric => metric !== null);

    if (metrics.length !== items.length) return;

    const nextLayout = calculateHomeRecommendationLayout(metrics);
    if (!layoutsMatch(layoutRef.current, nextLayout)) {
      layoutRef.current = nextLayout;
      setLayout(nextLayout);
      return;
    }

    if (!usesNaturalFlow) {
      applyRecommendationOverflowLayout(grid, metrics, nextLayout);
    }
  }, [items.length, usesNaturalFlow, usesSingleColumnLayout]);

  const scheduleMeasurement = useCallback(() => {
    if (scheduledFrameRef.current !== undefined) {
      window.cancelAnimationFrame(scheduledFrameRef.current);
    }

    scheduledFrameRef.current = window.requestAnimationFrame(() => {
      scheduledFrameRef.current = undefined;
      measureLayout();
    });
  }, [measureLayout]);

  useLayoutEffect(() => {
    measureLayout();
  }, [itemSignature, layout, measureLayout]);

  useEffect(() => {
    const grid = gridRef.current;

    if (!grid) return;

    let active = true;

    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => measureLayout()) : undefined;

    resizeObserver?.observe(grid);
    resizeObserver?.observe(grid.parentElement ?? grid);
    grid
      .querySelectorAll<HTMLElement>(".recommendation-card__header, .recommendation-expandable__quote")
      .forEach((element) => resizeObserver?.observe(element));
    const section = grid.closest<HTMLElement>(".home-section--recommendations");
    const sectionSurface = section ? getDirectChildByClassName(section, "home-section__surface") : null;
    const sectionHeader = sectionSurface?.querySelector<HTMLElement>(".home-section__header");

    if (sectionHeader) resizeObserver?.observe(sectionHeader);

    window.addEventListener("resize", scheduleMeasurement);
    scheduleMeasurement();
    void document.fonts?.ready.then(() => {
      if (active) scheduleMeasurement();
    });

    return () => {
      active = false;

      if (scheduledFrameRef.current !== undefined) {
        window.cancelAnimationFrame(scheduledFrameRef.current);
        scheduledFrameRef.current = undefined;
      }

      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);
      clearRecommendationOverflowLayout(grid);
    };
  }, [itemSignature, measureLayout, scheduleMeasurement]);

  if (items.length === 0) {
    return <EmptyState message="Professional recommendations will appear here when content is available." title="No recommendations yet" />;
  }

  return (
    <div className="home-recommendations">
      <div className="home-recommendations__grid" ref={gridRef}>
        {items.map((item) => {
          const itemLayout = layout[item.id];
          const itemStyle = itemLayout?.collapsedMinHeight
            ? ({
                "--recommendation-row-collapsed-height": `${itemLayout.collapsedMinHeight}px`
              } as RecommendationItemStyle)
            : undefined;

          return (
            <div
              className="home-recommendations__item"
              data-recommendation-id={item.id}
              key={item.id}
              style={itemStyle}
            >
              <RecommendationCard
                collapsedLineCount={itemLayout?.collapsedLineCount ?? defaultRecommendationPreviewLines}
                item={item}
                variant="summary"
              />
            </div>
          );
        })}
      </div>
      {showAction ? (
        <div className="home-recommendations__actions">
          <GlassButton href="/recommendations" variant="secondary">
            See all recommendations
          </GlassButton>
        </div>
      ) : null}
    </div>
  );
}
