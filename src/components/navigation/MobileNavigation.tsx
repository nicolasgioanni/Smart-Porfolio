"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortfolioLink } from "@/content/types";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { isNavigationItemActive, type NavigationItem } from "@/components/navigation/navigationItems";
import { MOBILE_UI_QUERY, useMediaQuery } from "@/components/responsive/useMediaQuery";

type MobileNavigationProps = {
  items: NavigationItem[];
  links: PortfolioLink[];
  open: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function MobileNavigation({ items, links, onOpenChange, open }: MobileNavigationProps) {
  const menuId = useId();
  const pathname = usePathname();
  const mobileUiMode = useMediaQuery(MOBILE_UI_QUERY);
  const navigationRootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousPathnameRef = useRef(pathname);
  const closedPanelAttributes = open ? {} : ({ inert: "" } as Record<string, string>);

  const updateOpen = useCallback((nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
  }, [onOpenChange]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      if (open) updateOpen(false);
    }
  }, [open, pathname, updateOpen]);

  useEffect(() => {
    if (!mobileUiMode && open) updateOpen(false);
  }, [mobileUiMode, open, updateOpen]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const navigationRoot = navigationRootRef.current;
      if (!navigationRoot) return;

      const eventPath = event.composedPath();
      if (eventPath.includes(navigationRoot)) return;

      updateOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      updateOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updateOpen]);

  function closeFromSocialLink(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("a")) updateOpen(false);
  }

  return (
    <div className="mobile-navigation" ref={navigationRootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        className="mobile-navigation__button hover-base-1 hover-base-1--compact"
        onClick={() => updateOpen(!open)}
        ref={triggerRef}
        type="button"
      >
        <span className="mobile-navigation__button-text">Menu</span>
        <span aria-hidden="true" className="mobile-navigation__button-lines" />
      </button>
      <div
        {...closedPanelAttributes}
        aria-hidden={!open}
        className="mobile-navigation__panel"
        data-state={open ? "open" : "closed"}
        id={menuId}
      >
        <nav aria-label="Mobile navigation" className="mobile-navigation__links">
          {items.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className="mobile-navigation__link hover-base-1 hover-base-1--compact"
                href={item.href}
                key={item.href}
                onClick={() => updateOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {links.length > 0 ? (
          <div className="mobile-navigation__social" aria-label="Primary links" onClick={closeFromSocialLink}>
            {links.slice(0, 4).map((link) => (
              <GlassIconLink key={link.id} kind={link.kind} label={link.label} url={link.url} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
