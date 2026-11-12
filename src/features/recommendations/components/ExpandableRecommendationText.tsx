"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";
import { SmartLink } from "@/components/navigation/SmartLink";
import type { PortfolioContentLink } from "@/content/types";
import { splitFirstSentence } from "@/lib/content/conciseText";
import { PHONE_HERO_QUERY, useMediaQuery } from "@/components/responsive/useMediaQuery";

const defaultCollapsedLineCount = 4;
const fallbackLineHeight = 22;
const fallbackCharactersPerLine = 52;

type QuoteMeasurement = {
  canExpand: boolean;
  collapsedHeight: number;
  expandedHeight: number;
  lineCount: number;
  measured: boolean;
  quote: string;
};

type ExpandableRecommendationTextProps = {
  collapsedLineCount?: number;
  expanded?: boolean;
  fullQuoteLink?: PortfolioContentLink;
  id: string;
  onExpandedChange?: (expanded: boolean) => void;
  quote: string;
  recommenderName: string;
};

function normalizeCollapsedLineCount(lineCount: number | undefined): number {
  if (!Number.isFinite(lineCount)) return defaultCollapsedLineCount;
  return Math.max(1, Math.floor(lineCount ?? defaultCollapsedLineCount));
}

function createFallbackMeasurement(quote: string, lineCount: number): QuoteMeasurement {
  const normalizedQuote = quote.trim().replace(/\s+/g, " ");
  const estimatedLineCount = Math.max(1, Math.ceil(normalizedQuote.length / fallbackCharactersPerLine));
  const collapsedHeight = lineCount * fallbackLineHeight;

  return {
    canExpand: estimatedLineCount > lineCount,
    collapsedHeight,
    expandedHeight: Math.max(collapsedHeight, estimatedLineCount * fallbackLineHeight),
    lineCount,
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

function renderQuoteWithLink(quote: string, link: PortfolioContentLink | undefined, start = 0, end = quote.length): ReactNode {
  const visibleText = quote.slice(start, end);
  if (!link?.label) return visibleText;

  const linkStart = quote.indexOf(link.label);

  const linkEnd = linkStart + link.label.length;
  if (linkStart < 0 || linkStart !== quote.lastIndexOf(link.label) || linkEnd <= start || linkStart >= end) return visibleText;
  const visibleLinkStart = Math.max(start, linkStart);
  const visibleLinkEnd = Math.min(end, linkEnd);

  return (
    <>
      {quote.slice(start, visibleLinkStart)}
      <SmartLink className="recommendation-expandable__inline-link" href={link.url}>
        {quote.slice(visibleLinkStart, visibleLinkEnd)}
      </SmartLink>
      {quote.slice(visibleLinkEnd, end)}
    </>
  );
}

export function ExpandableRecommendationText({
  collapsedLineCount,
  expanded: controlledExpanded,
  fullQuoteLink,
  id,
  onExpandedChange,
  quote,
  recommenderName
}: ExpandableRecommendationTextProps) {
  const quoteRef = useRef<HTMLQuoteElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [measurement, setMeasurement] = useState<QuoteMeasurement | null>(null);
  const expanded = controlledExpanded ?? internalExpanded;
  const isControlled = controlledExpanded !== undefined;
  const prefersReducedMotion = useReducedMotionPreference();
  const phoneLayout = useMediaQuery(PHONE_HERO_QUERY);
  const [firstSentence, remainingSentences] = useMemo(() => splitFirstSentence(quote), [quote]);
  const resolvedLineCount = normalizeCollapsedLineCount(collapsedLineCount);
  const fallbackMeasurement = useMemo(
    () => createFallbackMeasurement(quote, resolvedLineCount),
    [quote, resolvedLineCount]
  );
  const resolvedMeasurement =
    measurement?.quote === quote && measurement.lineCount === resolvedLineCount ? measurement : fallbackMeasurement;
  const canExpand = phoneLayout ? Boolean(remainingSentences.trim()) : resolvedMeasurement.canExpand;
  const controlledId = `recommendation-${sanitizeDomId(id)}-quote`;

  const updateExpanded = useCallback(
    (nextExpanded: boolean) => {
      if (!isControlled) {
        setInternalExpanded(nextExpanded);
      }

      onExpandedChange?.(nextExpanded);
    },
    [isControlled, onExpandedChange]
  );

  const measureQuote = useCallback(() => {
    const quoteElement = quoteRef.current;

    if (!quoteElement) return;

    const lineHeight = getLineHeight(quoteElement);
    const collapsedHeight = Math.ceil(lineHeight * resolvedLineCount);
    const naturalHeight = Math.ceil(quoteElement.scrollHeight);
    const nextMeasurement =
      naturalHeight > 0
        ? {
            canExpand: naturalHeight > collapsedHeight + 1,
            collapsedHeight,
            expandedHeight: Math.max(collapsedHeight, naturalHeight),
            lineCount: resolvedLineCount,
            measured: true,
            quote
          }
        : createFallbackMeasurement(quote, resolvedLineCount);

    setMeasurement((currentMeasurement) => {
      if (
        currentMeasurement?.quote === nextMeasurement.quote &&
        currentMeasurement.canExpand === nextMeasurement.canExpand &&
        currentMeasurement.collapsedHeight === nextMeasurement.collapsedHeight &&
        currentMeasurement.expandedHeight === nextMeasurement.expandedHeight &&
        currentMeasurement.lineCount === nextMeasurement.lineCount &&
        currentMeasurement.measured === nextMeasurement.measured
      ) {
        return currentMeasurement;
      }

      return nextMeasurement;
    });
  }, [quote, resolvedLineCount]);

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

  useEffect(() => {
    if (!canExpand && expanded) {
      updateExpanded(false);
    }
  }, [expanded, canExpand, updateExpanded]);

  useEffect(() => {
    if (!expanded) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      event.stopPropagation();
      updateExpanded(false);
      toggleRef.current?.focus();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [expanded, updateExpanded]);

  const style = {
    "--recommendation-collapsed-height": `${resolvedMeasurement.collapsedHeight}px`,
    "--recommendation-expanded-height": `${resolvedMeasurement.expandedHeight}px`
  } as CSSProperties;
  const toggleLabel = expanded ? "Show less" : "Show more";

  return (
    <div
      className="recommendation-expandable"
      data-can-expand={canExpand ? "true" : "false"}
      data-has-more-sentences={remainingSentences.trim() ? "true" : "false"}
      data-collapsed-lines={resolvedLineCount}
      data-expanded={expanded ? "true" : "false"}
      data-measured={resolvedMeasurement.measured ? "true" : "false"}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      style={style}
    >
      <div className="recommendation-expandable__viewport" id={controlledId}>
        <blockquote className="recommendation-expandable__quote" ref={quoteRef}>
          {renderQuoteWithLink(quote, fullQuoteLink, 0, firstSentence.length)}
          {remainingSentences ? (
            <span className="recommendation-expandable__remainder">
              {renderQuoteWithLink(quote, fullQuoteLink, firstSentence.length)}
            </span>
          ) : null}
        </blockquote>
      </div>

      {canExpand || remainingSentences.trim() ? (
        <button
          aria-controls={controlledId}
          aria-expanded={expanded}
          aria-label={`${toggleLabel} recommendation from ${recommenderName}`}
          className="recommendation-expandable__toggle"
          onClick={() => updateExpanded(!expanded)}
          ref={toggleRef}
          type="button"
        >
          {toggleLabel}
        </button>
      ) : null}
    </div>
  );
}
