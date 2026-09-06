"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";
import type { DetailMode, DetailSection } from "@/lib/content/detailNarratives";

type DetailDisclosureListProps = {
  idPrefix: string;
  itemId: string;
  mode: DetailMode;
  onToggle: (sectionId: string) => void;
  openSectionId?: string;
  overlayEnabled: boolean;
  sections: DetailSection[];
};

type DetailDisclosureProps = Omit<DetailDisclosureListProps, "openSectionId" | "sections"> & {
  open: boolean;
  order: number;
  overlayEnabled: boolean;
  section: DetailSection;
};

type DetailVisualState = "closed" | "closing" | "open";

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function DisclosureIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function DetailDisclosure({
  idPrefix,
  itemId,
  mode,
  onToggle,
  open,
  order,
  overlayEnabled,
  section
}: DetailDisclosureProps) {
  const disclosureId = `${safeId(idPrefix)}-${safeId(itemId)}-${mode}-${safeId(section.id)}`;
  const panelId = `${disclosureId}-panel`;
  const titleId = `${disclosureId}-title`;
  const expandable = section.details.length > 0 || Boolean(section.tools?.length);
  const [visualState, setVisualState] = useState<DetailVisualState>(open ? "open" : "closed");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeGenerationRef = useRef(0);
  const previousOverlayEnabledRef = useRef(overlayEnabled);
  const prefersReducedMotion = useReducedMotionPreference();

  useLayoutEffect(() => {
    const layoutChanged = previousOverlayEnabledRef.current !== overlayEnabled;

    previousOverlayEnabledRef.current = overlayEnabled;
    if (open) {
      closeGenerationRef.current += 1;
      setVisualState("open");
      return;
    }

    setVisualState((current) => {
      if (layoutChanged || prefersReducedMotion || current === "closed") return "closed";
      closeGenerationRef.current += 1;
      return "closing";
    });
  }, [open, overlayEnabled, prefersReducedMotion]);

  useEffect(() => {
    if (open || visualState !== "closing") return;

    const panel = panelRef.current;
    const clip = panel?.querySelector<HTMLElement>(".detail-section__panel-clip");
    if (!clip) return;

    const closeGeneration = closeGenerationRef.current;
    const settleWhenCollapsed = () => {
      if (closeGenerationRef.current !== closeGeneration || clip.getBoundingClientRect().height > 0.5) return;

      setVisualState((current) => (current === "closing" ? "closed" : current));
    };
    const frame = window.requestAnimationFrame(settleWhenCollapsed);
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(settleWhenCollapsed) : undefined;
    resizeObserver?.observe(clip);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [open, visualState]);

  const summary = (
    <>
      <span aria-hidden="true" className="detail-section__number">
        {String(order + 1).padStart(2, "0")}
      </span>
      <span className="detail-section__copy">
        <span aria-level={3} className="detail-section__title" id={titleId} role="heading">
          {section.title}
        </span>
        <span className="detail-section__lead">{section.lead}</span>
      </span>
      {section.signal ? <span className="detail-section__signal">{section.signal}</span> : null}
    </>
  );

  if (!expandable) {
    return (
      <div className="detail-section detail-section--static">
        <div className="detail-section__trigger detail-section__trigger--static">{summary}</div>
      </div>
    );
  }

  const panelIsInteractive = open;

  return (
    <div
      className="detail-section"
      data-open={open ? "true" : "false"}
      data-section-id={section.id}
      data-visual-state={visualState}
    >
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="detail-section__trigger"
        id={disclosureId}
        onClick={() => onToggle(section.id)}
        type="button"
      >
        {summary}
        <span aria-hidden="true" className="detail-section__icon">
          <DisclosureIcon />
        </span>
      </button>
      <div
        aria-hidden={!panelIsInteractive}
        aria-labelledby={titleId}
        className="detail-section__panel"
        id={panelId}
        inert={!panelIsInteractive}
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget || event.propertyName !== "grid-template-rows") return;

          const clip = event.currentTarget.querySelector<HTMLElement>(".detail-section__panel-clip");
          if (!open && visualState === "closing" && (clip?.getBoundingClientRect().height ?? 1) <= 0.5) {
            setVisualState("closed");
          }
        }}
        ref={panelRef}
        role="region"
      >
        <div
          aria-labelledby={titleId}
          className="detail-section__panel-clip"
          role="group"
          tabIndex={panelIsInteractive ? 0 : -1}
        >
          <div className="detail-section__panel-content">
            {section.details.length > 0 ? (
              <ul className="detail-section__details">
                {section.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            {section.tools && section.tools.length > 0 ? (
              <ul aria-label={`${section.title} tools`} className="detail-section__tools">
                {section.tools.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailDisclosureList({
  idPrefix,
  itemId,
  mode,
  onToggle,
  openSectionId,
  overlayEnabled,
  sections
}: DetailDisclosureListProps) {
  if (sections.length === 0) return null;

  return (
    <div className="detail-list" data-detail-item-id={itemId} data-layout-mode={overlayEnabled ? "overlay" : "natural"}>
      {sections.map((section, index) => (
        <DetailDisclosure
          idPrefix={idPrefix}
          itemId={itemId}
          key={section.id}
          mode={mode}
          onToggle={onToggle}
          open={openSectionId === section.id}
          order={index}
          overlayEnabled={overlayEnabled}
          section={section}
        />
      ))}
    </div>
  );
}
