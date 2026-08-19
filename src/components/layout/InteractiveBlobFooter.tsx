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

const FOOTER_EXPAND_VISIBILITY_RATIO = 0.5;
const FOOTER_COLLAPSE_VISIBILITY_RATIO = 0.15;
const FOOTER_OBSERVER_THRESHOLDS = [0, FOOTER_COLLAPSE_VISIBILITY_RATIO, FOOTER_EXPAND_VISIBILITY_RATIO, 1];

type ScrollDirection = "down" | "idle" | "up";

function isRetreatingBelowViewport(entry: IntersectionObserverEntry): boolean {
  const viewportBottom = entry.rootBounds?.bottom ?? window.innerHeight;

  return entry.boundingClientRect.top >= 0 && entry.boundingClientRect.bottom >= viewportBottom;
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
  const viewportTriggerRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const expandedRef = useRef(false);
  const isVisibleRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const manualCollapseSuppressedRef = useRef(false);
  const pendingCollapseRef = useRef(false);
  const scrollDirectionRef = useRef<ScrollDirection>("idle");
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

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

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    lastScrollYRef.current = window.scrollY;
    manualCollapseSuppressedRef.current = false;
    scrollDirectionRef.current = "idle";
    collapseUnlessDetailsFocused();
  }, [collapseUnlessDetailsFocused, pathname]);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollYRef.current) {
        scrollDirectionRef.current = "down";
      } else if (currentScrollY < lastScrollYRef.current) {
        scrollDirectionRef.current = "up";
      }

      lastScrollYRef.current = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;

      isVisibleRef.current = entry.isIntersecting;
      if (!entry.isIntersecting) {
        manualCollapseSuppressedRef.current = false;
        collapseUnlessDetailsFocused();
      }
    }, { threshold: 0 });

    observer.observe(footer);
    return () => observer.disconnect();
  }, [collapseUnlessDetailsFocused]);

  useEffect(() => {
    const viewportTrigger = viewportTriggerRef.current;
    if (!viewportTrigger || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;

        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= FOOTER_EXPAND_VISIBILITY_RATIO &&
          !manualCollapseSuppressedRef.current &&
          !pendingCollapseRef.current
        ) {
          expandNow();
          return;
        }

        if (
          expandedRef.current &&
          scrollDirectionRef.current === "up" &&
          entry.intersectionRatio <= FOOTER_COLLAPSE_VISIBILITY_RATIO &&
          isRetreatingBelowViewport(entry)
        ) {
          collapseUnlessDetailsFocused();
        }
      },
      { threshold: FOOTER_OBSERVER_THRESHOLDS }
    );

    observer.observe(viewportTrigger);

    return () => {
      observer.disconnect();
    };
  }, [collapseUnlessDetailsFocused, expandNow, pathname]);

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
      <span aria-hidden="true" className="blob-footer__viewport-trigger" ref={viewportTriggerRef} />
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
