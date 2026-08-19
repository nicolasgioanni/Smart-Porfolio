"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { GlassBlob } from "@/components/glass/GlassBlob";
import { SmartLink } from "@/components/navigation/SmartLink";

export type ProgressiveFooterLink = {
  href: string;
  label: string;
};

type InteractiveBlobFooterProps = {
  closingStatement: string;
  compactCopyright: string;
  identityDescription: string;
  noticeLinks: ProgressiveFooterLink[];
  owner: string;
  resourceLinks: ProgressiveFooterLink[];
};

export const FOOTER_SCROLL_INTENT_THRESHOLD = 140;
const DOCUMENT_BOTTOM_TOLERANCE = 2;

export function normalizeWheelDelta(deltaY: number, deltaMode: number, viewportHeight: number): number {
  if (!Number.isFinite(deltaY)) return 0;

  if (deltaMode === WheelEvent.DOM_DELTA_LINE) return deltaY * 16;
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return deltaY * viewportHeight;

  return deltaY;
}

export function isFooterControlTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      "a, button, input, select, textarea, [contenteditable]:not([contenteditable='false']), [role='button'], [role='combobox'], [role='link'], [role='textbox']"
    )
  );
}

function getDocumentHeight(): number {
  const body = document.body;
  const root = document.documentElement;
  const scrollingElement = document.scrollingElement;

  return Math.max(
    root.scrollHeight,
    root.offsetHeight,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    scrollingElement?.scrollHeight ?? 0
  );
}

export function isAtDocumentBottom(): boolean {
  return getDocumentHeight() - (window.scrollY + window.innerHeight) <= DOCUMENT_BOTTOM_TOLERANCE;
}

function keyboardScrollIntent(event: KeyboardEvent): number {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return 0;
  if (isFooterControlTarget(event.target)) return 0;

  switch (event.key) {
    case "ArrowDown":
      return 40;
    case "PageDown":
    case " ":
    case "Spacebar":
      return 100;
    case "End":
      return FOOTER_SCROLL_INTENT_THRESHOLD;
    default:
      return 0;
  }
}

function FooterLinkList({ label, links }: { label: string; links: ProgressiveFooterLink[] }) {
  return (
    <nav aria-label={label} className="blob-footer__column">
      <h2 className="blob-footer__heading">{label}</h2>
      <ul className="blob-footer__links">
        {links.map((link) => (
          <li key={`${link.label}-${link.href}`}>
            <SmartLink className="blob-footer__link hover-base-1 hover-base-1--compact" href={link.href}>
              {link.label}
            </SmartLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function InteractiveBlobFooter({
  closingStatement,
  compactCopyright,
  identityDescription,
  noticeLinks,
  owner,
  resourceLinks
}: InteractiveBlobFooterProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const detailsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const intentRef = useRef(0);
  const isVisibleRef = useRef(false);
  const pendingCollapseRef = useRef(false);
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

  const collapseNow = useCallback(() => {
    intentRef.current = 0;
    pendingCollapseRef.current = false;
    setExpanded(false);
  }, []);

  const collapseUnlessDetailsFocused = useCallback(() => {
    if (detailsRef.current?.contains(document.activeElement)) {
      pendingCollapseRef.current = true;
      return;
    }

    collapseNow();
  }, [collapseNow]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    collapseUnlessDetailsFocused();
  }, [collapseUnlessDetailsFocused, pathname]);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;

      isVisibleRef.current = entry.isIntersecting;
      if (!entry.isIntersecting) collapseUnlessDetailsFocused();
    });

    observer.observe(footer);
    return () => observer.disconnect();
  }, [collapseUnlessDetailsFocused]);

  useEffect(() => {
    function recordIntent(delta: number) {
      if (expanded) return;

      if (delta < 0 || !isAtDocumentBottom()) {
        intentRef.current = 0;
        return;
      }

      if (delta === 0) return;

      intentRef.current += Math.min(delta, FOOTER_SCROLL_INTENT_THRESHOLD);
      if (intentRef.current < FOOTER_SCROLL_INTENT_THRESHOLD) return;

      intentRef.current = 0;
      setExpanded(true);
    }

    function handleWheel(event: WheelEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;

      recordIntent(normalizeWheelDelta(event.deltaY, event.deltaMode, window.innerHeight));
    }

    let previousTouchY: number | null = null;

    function handleTouchStart(event: TouchEvent) {
      previousTouchY = event.touches.length === 1 ? event.touches[0]?.clientY ?? null : null;
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches.length !== 1 || previousTouchY === null) {
        previousTouchY = null;
        intentRef.current = 0;
        return;
      }

      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) return;

      const delta = previousTouchY - currentY;
      previousTouchY = currentY;
      recordIntent(delta);
    }

    function handleTouchEnd() {
      previousTouchY = null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const delta = keyboardScrollIntent(event);
      if (delta > 0) recordIntent(delta);
    }

    function handleScroll() {
      if (!expanded && !isAtDocumentBottom()) {
        intentRef.current = 0;
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);

  function handleToggle() {
    if (!expanded) {
      intentRef.current = 0;
      setExpanded(true);
      return;
    }

    if (detailsRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }

    collapseNow();
  }

  function handleBlur(event: React.FocusEvent<HTMLElement>) {
    if (event.relatedTarget instanceof Node && detailsRef.current?.contains(event.relatedTarget)) return;
    if (pendingCollapseRef.current || !isVisibleRef.current) collapseNow();
  }

  return (
    <footer
      className={["blob-footer", expanded ? "blob-footer--expanded" : "blob-footer--compact"].join(" ")}
      data-footer-state={expanded ? "expanded" : "compact"}
      onBlurCapture={handleBlur}
      ref={footerRef}
    >
      <GlassBlob className="blob-footer__island" tone="footer">
        <div className="blob-footer__compact">
          <p className="blob-footer__copyright">{compactCopyright}</p>
          <button
            aria-controls={detailsId}
            aria-expanded={expanded}
            className="blob-footer__toggle hover-base-1 hover-base-1--compact"
            onClick={handleToggle}
            ref={toggleRef}
            type="button"
          >
            {expanded ? "Collapse" : "Details"}
          </button>
        </div>

        <div
          {...(!expanded ? ({ inert: "" } as unknown as { inert: boolean }) : {})}
          aria-hidden={!expanded}
          className="blob-footer__details"
          id={detailsId}
          ref={detailsRef}
        >
          <div className="blob-footer__details-inner">
            <div className="blob-footer__details-grid">
              <section aria-labelledby={`${detailsId}-identity`} className="blob-footer__identity">
                <h2 className="blob-footer__owner" id={`${detailsId}-identity`}>
                  {owner}
                </h2>
                <p className="blob-footer__description">{identityDescription}</p>
              </section>
              <FooterLinkList label="Notices" links={noticeLinks} />
              <FooterLinkList label="Resources" links={resourceLinks} />
            </div>
            <p className="blob-footer__closing">{closingStatement}</p>
          </div>
        </div>
      </GlassBlob>
    </footer>
  );
}
