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

type ScrollDirection = "down" | "idle" | "up";

const DOWNWARD_SCROLL_KEYS = new Set([" ", "ArrowDown", "End", "PageDown", "Spacebar"]);

type RunwayPosition = {
  bottom: number;
  top: number;
  viewportBottom: number;
};

function isBelowViewport(position: RunwayPosition): boolean {
  return position.top >= position.viewportBottom;
}

function isFullyVisible(position: RunwayPosition): boolean {
  return position.top >= 0 && position.bottom <= position.viewportBottom;
}

function isEditableOrInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      "a, button, input, select, textarea, [contenteditable]:not([contenteditable='false']), [role='button'], [role='combobox'], [role='link'], [role='textbox']"
    )
  );
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

export function InteractiveBlobFooter(props: InteractiveBlobFooterProps) {
  const pathname = usePathname();

  return <RouteScopedInteractiveBlobFooter key={pathname} {...props} />;
}

function RouteScopedInteractiveBlobFooter({
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
  const runwaySentinelRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const expandedRef = useRef(false);
  const isVisibleRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const manualCollapseSuppressedRef = useRef(false);
  const pendingCollapseRef = useRef(false);
  const scrollActivationArmedRef = useRef(false);

  const expandNow = useCallback(() => {
    pendingCollapseRef.current = false;
    expandedRef.current = true;
    setExpanded(true);
  }, []);

  const collapseNow = useCallback(() => {
    pendingCollapseRef.current = false;
    expandedRef.current = false;
    setExpanded(false);
  }, []);

  const collapseUnlessDetailsFocused = useCallback(() => {
    if (detailsRef.current?.contains(document.activeElement)) {
      pendingCollapseRef.current = true;
      return;
    }

    collapseNow();
  }, [collapseNow]);

  const evaluateRunwayPosition = useCallback(
    (position: RunwayPosition, direction: ScrollDirection) => {
      const fullyVisible = isFullyVisible(position);

      if (
        fullyVisible &&
        direction === "down" &&
        !expandedRef.current &&
        !manualCollapseSuppressedRef.current &&
        !pendingCollapseRef.current
      ) {
        expandNow();
        return;
      }

      if (expandedRef.current && direction === "up" && isBelowViewport(position)) {
        collapseUnlessDetailsFocused();
      }
    },
    [collapseUnlessDetailsFocused, expandNow]
  );

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    function handleWheel(event: WheelEvent) {
      if (event.deltaY > 0) scrollActivationArmedRef.current = true;
    }

    function handleTouchStart() {
      scrollActivationArmedRef.current = true;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.isPrimary && event.button === 0) scrollActivationArmedRef.current = true;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented ||
        !DOWNWARD_SCROLL_KEYS.has(event.key) ||
        isEditableOrInteractiveTarget(event.target)
      ) {
        return;
      }

      scrollActivationArmedRef.current = true;
    }

    function handleScroll() {
      const currentScrollY = window.scrollY;
      let direction: ScrollDirection = "idle";

      if (currentScrollY > lastScrollYRef.current) {
        direction = "down";
      } else if (currentScrollY < lastScrollYRef.current) {
        direction = "up";
      }

      lastScrollYRef.current = currentScrollY;

      const runwaySentinel = runwaySentinelRef.current;
      if (!runwaySentinel || direction === "idle") return;

      const { bottom, top } = runwaySentinel.getBoundingClientRect();
      if (direction === "up" || scrollActivationArmedRef.current) {
        evaluateRunwayPosition({ bottom, top, viewportBottom: window.innerHeight }, direction);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("wheel", handleWheel);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [evaluateRunwayPosition]);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const island = footer.querySelector<HTMLElement>(".blob-footer__island");
    if (!island) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;

      isVisibleRef.current = entry.isIntersecting;
      if (!entry.isIntersecting) {
        manualCollapseSuppressedRef.current = false;
        collapseUnlessDetailsFocused();
      }
    }, { threshold: 0 });

    observer.observe(island);
    return () => observer.disconnect();
  }, [collapseUnlessDetailsFocused]);

  function handleToggle() {
    if (!expanded) {
      manualCollapseSuppressedRef.current = false;
      expandNow();
      return;
    }

    if (detailsRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }

    manualCollapseSuppressedRef.current = true;
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
      <div aria-hidden="true" className="blob-footer__runway">
        <span aria-hidden="true" className="blob-footer__runway-sentinel" ref={runwaySentinelRef} />
      </div>
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
