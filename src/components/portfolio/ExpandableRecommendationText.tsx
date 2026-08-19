"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";

const collapsedLineCount = 4;
const fallbackLineHeight = 24;
const fallbackCharactersPerLine = 52;

type QuoteMeasurement = {
  canExpand: boolean;
  collapsedHeight: number;
  expandedHeight: number;
  measured: boolean;
  quote: string;
};

type ExpandableRecommendationTextProps = {
  id: string;
  quote: string;
  recommenderName: string;
};

function createFallbackMeasurement(quote: string): QuoteMeasurement {
  const normalizedQuote = quote.trim().replace(/\s+/g, " ");
  const estimatedLineCount = Math.max(1, Math.ceil(normalizedQuote.length / fallbackCharactersPerLine));
  const collapsedHeight = collapsedLineCount * fallbackLineHeight;

  return {
    canExpand: estimatedLineCount > collapsedLineCount,
    collapsedHeight,
    expandedHeight: Math.max(collapsedHeight, estimatedLineCount * fallbackLineHeight),
    measured: false,
    quote
  };
}

function getLineHeight(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element);
  const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);

  if (Number.isFinite(parsedLineHeight) && parsedLineHeight > 0) {
    return parsedLineHeight;
  }

  const parsedFontSize = Number.parseFloat(computedStyle.fontSize);
  return Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize * 1.5 : fallbackLineHeight;
}

function sanitizeDomId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "recommendation";
}

export function ExpandableRecommendationText({ id, quote, recommenderName }: ExpandableRecommendationTextProps) {
  const quoteRef = useRef<HTMLQuoteElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [measurement, setMeasurement] = useState<QuoteMeasurement | null>(null);
  const prefersReducedMotion = useReducedMotionPreference();
  const fallbackMeasurement = useMemo(() => createFallbackMeasurement(quote), [quote]);
  const resolvedMeasurement = measurement?.quote === quote ? measurement : fallbackMeasurement;
  const controlledId = `recommendation-${sanitizeDomId(id)}-quote`;

  const measureQuote = useCallback(() => {
    const quoteElement = quoteRef.current;

    if (!quoteElement) return;

    const lineHeight = getLineHeight(quoteElement);
    const collapsedHeight = Math.ceil(lineHeight * collapsedLineCount);
    const naturalHeight = Math.ceil(quoteElement.scrollHeight);
    const nextMeasurement =
      naturalHeight > 0
        ? {
            canExpand: naturalHeight > collapsedHeight + 1,
            collapsedHeight,
            expandedHeight: Math.max(collapsedHeight, naturalHeight),
            measured: true,
            quote
          }
        : createFallbackMeasurement(quote);

    setMeasurement((currentMeasurement) => {
      if (
        currentMeasurement?.quote === nextMeasurement.quote &&
        currentMeasurement.canExpand === nextMeasurement.canExpand &&
        currentMeasurement.collapsedHeight === nextMeasurement.collapsedHeight &&
        currentMeasurement.expandedHeight === nextMeasurement.expandedHeight &&
        currentMeasurement.measured === nextMeasurement.measured
      ) {
        return currentMeasurement;
      }

      return nextMeasurement;
    });
  }, [quote]);

  useEffect(() => {
    const quoteElement = quoteRef.current;

    if (!quoteElement) return;

    measureQuote();
    window.addEventListener("resize", measureQuote);

    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => measureQuote()) : undefined;
    resizeObserver?.observe(quoteElement);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureQuote);
    };
  }, [measureQuote]);

  const style = {
    "--recommendation-collapsed-height": `${resolvedMeasurement.collapsedHeight}px`,
    "--recommendation-expanded-height": `${resolvedMeasurement.expandedHeight}px`
  } as CSSProperties;
  const toggleLabel = expanded ? "Show less" : "Show more";

  return (
    <div
      className="recommendation-expandable"
      data-can-expand={resolvedMeasurement.canExpand ? "true" : "false"}
      data-collapsed-lines={collapsedLineCount}
      data-expanded={expanded ? "true" : "false"}
      data-measured={resolvedMeasurement.measured ? "true" : "false"}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      style={style}
    >
      <div className="recommendation-expandable__viewport" id={controlledId}>
        <blockquote className="recommendation-expandable__quote" ref={quoteRef}>
          {quote}
        </blockquote>
      </div>

      {resolvedMeasurement.canExpand ? (
        <button
          aria-controls={controlledId}
          aria-expanded={expanded}
          aria-label={`${toggleLabel} recommendation from ${recommenderName}`}
          className="recommendation-expandable__toggle"
          onClick={() => setExpanded((currentExpanded) => !currentExpanded)}
          type="button"
        >
          {toggleLabel}
        </button>
      ) : null}
    </div>
  );
}
