"use client";

import type { FocusEvent as ReactFocusEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RecommendationItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { RecommendationCard } from "@/components/portfolio/RecommendationCard";
import { MOBILE_UI_QUERY, useMediaQuery } from "@/components/responsive/useMediaQuery";

const collapsedHeightProperty = "--recommendation-detail-collapsed-height";
const overflowReserveProperty = "--recommendations-overlay-reserve";
const overlapTolerance = 1;

function getRecommendationSlots(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".recommendations-list__item"));
}

function getRecommendationCard(slot: HTMLElement): HTMLElement | null {
  return slot.querySelector<HTMLElement>(".recommendation-card--detail");
}

function getRenderedHeight(element: HTMLElement): number {
  if (element.offsetHeight > 0) return element.offsetHeight;
  return element.getBoundingClientRect().height;
}

function rectanglesOverlap(activeRect: DOMRect, candidateRect: DOMRect): boolean {
  return (
    activeRect.left < candidateRect.right - overlapTolerance &&
    activeRect.right > candidateRect.left + overlapTolerance &&
    activeRect.top < candidateRect.bottom - overlapTolerance &&
    activeRect.bottom > candidateRect.top + overlapTolerance
  );
}

function setPixelCustomProperty(element: HTMLElement, property: string, value: number) {
  const nextValue = `${Math.max(0, Math.ceil(value))}px`;

  if (element.style.getPropertyValue(property) !== nextValue) {
    element.style.setProperty(property, nextValue);
  }
}

function clearOverlayGeometry(root: HTMLElement) {
  setPixelCustomProperty(root, overflowReserveProperty, 0);
  getRecommendationSlots(root).forEach((slot) => {
    slot.dataset.overlapped = "false";
  });
}

function measureCollapsedSlotHeights(root: HTMLElement, activeId: string | null): boolean {
  let allSlotsMeasured = true;

  for (const slot of getRecommendationSlots(root)) {
    const id = slot.dataset.recommendationId;
    const card = getRecommendationCard(slot);

    if (!id || !card) {
      allSlotsMeasured = false;
      continue;
    }

    if (id !== activeId) {
      const renderedHeight = getRenderedHeight(card);

      if (renderedHeight > 0) {
        setPixelCustomProperty(slot, collapsedHeightProperty, renderedHeight);
      }
    }

    if (!slot.style.getPropertyValue(collapsedHeightProperty)) {
      allSlotsMeasured = false;
    }
  }

  root.dataset.overlayReady = allSlotsMeasured ? "true" : "false";
  return allSlotsMeasured;
}

function updateOverlayGeometry(root: HTMLElement, activeId: string | null, usesNaturalFlow: boolean) {
  if (usesNaturalFlow || !activeId || root.dataset.overlayReady !== "true") {
    clearOverlayGeometry(root);
    return;
  }

  const grid = root.querySelector<HTMLElement>(".featured-grid");
  const activeSlot = getRecommendationSlots(root).find((slot) => slot.dataset.recommendationId === activeId);
  const activeCard = activeSlot ? getRecommendationCard(activeSlot) : null;

  if (!grid || !activeCard) {
    clearOverlayGeometry(root);
    return;
  }

  const activeRect = activeCard.getBoundingClientRect();

  for (const slot of getRecommendationSlots(root)) {
    if (slot === activeSlot) {
      slot.dataset.overlapped = "false";
      continue;
    }

    const candidateCard = getRecommendationCard(slot);
    slot.dataset.overlapped = candidateCard && rectanglesOverlap(activeRect, candidateCard.getBoundingClientRect())
      ? "true"
      : "false";
  }

  const gridRect = grid.getBoundingClientRect();
  setPixelCustomProperty(root, overflowReserveProperty, Math.max(0, activeRect.bottom - gridRect.bottom));
}

export function RecommendationsList({ items }: { items: RecommendationItem[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scheduledFrameRef = useRef<number>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const usesNaturalFlow = useMediaQuery(MOBILE_UI_QUERY);
  const previousNaturalFlowRef = useRef(usesNaturalFlow);
  const itemSignature = useMemo(() => items.map((item) => item.id).join("|"), [items]);

  const measureLayout = useCallback(() => {
    const root = rootRef.current;

    if (!root) return;

    if (usesNaturalFlow) {
      root.dataset.overlayReady = "false";
      clearOverlayGeometry(root);
      return;
    }

    measureCollapsedSlotHeights(root, activeId);
    updateOverlayGeometry(root, activeId, false);
  }, [activeId, usesNaturalFlow]);

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
  }, [itemSignature, measureLayout]);

  useEffect(() => {
    if (previousNaturalFlowRef.current !== usesNaturalFlow) {
      previousNaturalFlowRef.current = usesNaturalFlow;
      setActiveId(null);
    }
  }, [usesNaturalFlow]);

  useEffect(() => {
    if (activeId && !items.some((item) => item.id === activeId)) {
      setActiveId(null);
    }
  }, [activeId, items]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) return;

    let active = true;
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => scheduleMeasurement())
      : undefined;

    root.querySelectorAll<HTMLElement>(".featured-grid, .recommendation-card--detail").forEach((element) => {
      resizeObserver?.observe(element);
    });
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
      clearOverlayGeometry(root);
    };
  }, [itemSignature, scheduleMeasurement]);

  const handleFocusCapture = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (!activeId) return;

    const focusedSlot = (event.target as Element).closest<HTMLElement>(".recommendations-list__item");

    if (focusedSlot?.dataset.recommendationId && focusedSlot.dataset.recommendationId !== activeId) {
      setActiveId(null);
    }
  };

  if (items.length === 0) {
    return <EmptyState message="Professional recommendations will appear here when content is available." title="No recommendations yet" />;
  }

  return (
    <div
      className="recommendations-list"
      data-layout-mode={usesNaturalFlow ? "natural" : "overlay"}
      onFocusCapture={handleFocusCapture}
      ref={rootRef}
    >
      <FeaturedGrid columns="two" itemCount={items.length}>
        {items.map((item) => (
          <div
            className="recommendations-list__item"
            data-expanded={activeId === item.id ? "true" : "false"}
            data-overlapped="false"
            data-recommendation-id={item.id}
            key={item.id}
          >
            <RecommendationCard
              expanded={activeId === item.id}
              item={item}
              onExpandedChange={(nextExpanded) => {
                setActiveId((currentActiveId) => {
                  if (nextExpanded) return item.id;
                  return currentActiveId === item.id ? null : currentActiveId;
                });
              }}
            />
          </div>
        ))}
      </FeaturedGrid>
    </div>
  );
}
