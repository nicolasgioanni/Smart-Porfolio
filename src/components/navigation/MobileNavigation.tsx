"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortfolioLink } from "@/content/types";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { isNavigationItemActive, type NavigationItem } from "@/components/navigation/navigationItems";

type MobileNavigationProps = {
  items: NavigationItem[];
  links: PortfolioLink[];
  open: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function MobileNavigation({ items, links, onOpenChange, open }: MobileNavigationProps) {
  const menuId = useId();
  const pathname = usePathname();

  function updateOpen(nextOpen: boolean) {
    onOpenChange?.(nextOpen);
  }

  return (
    <div className="mobile-navigation">
      <button
        aria-controls={menuId}
        aria-expanded={open}
        className="mobile-navigation__button hover-base-1 hover-base-1--compact"
        onClick={() => updateOpen(!open)}
        type="button"
      >
        <span className="mobile-navigation__button-text">Menu</span>
        <span aria-hidden="true" className="mobile-navigation__button-lines" />
      </button>
      <div className="mobile-navigation__panel" hidden={!open} id={menuId}>
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
          <div className="mobile-navigation__social" aria-label="Primary links">
            {links.slice(0, 4).map((link) => (
              <GlassIconLink key={link.id} kind={link.kind} label={link.label} url={link.url} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
