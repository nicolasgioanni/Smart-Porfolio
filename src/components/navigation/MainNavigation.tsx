"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActiveRouteIndicator } from "@/components/navigation/ActiveRouteIndicator";
import { isNavigationItemActive, type NavigationItem } from "@/components/navigation/navigationItems";
import { useActiveRouteIndicator } from "@/components/navigation/useActiveRouteIndicator";

export function MainNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  const activeItem = items.find((item) => isNavigationItemActive(pathname, item.href));
  const { indicatorRef, navigationRef } = useActiveRouteIndicator({ activeHref: activeItem?.href, pathname });

  return (
    <nav
      aria-label="Main navigation"
      className="main-navigation"
      data-route-indicator-ready="false"
      ref={navigationRef}
    >
      <ActiveRouteIndicator ref={indicatorRef} visible={Boolean(activeItem)} />
      {items.map((item) => {
        const active = item.href === activeItem?.href;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className="main-navigation__link hover-base-1 hover-base-1--route"
            data-navigation-link="true"
            data-route-active={active ? "true" : undefined}
            href={item.href}
            key={item.href}
          >
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
