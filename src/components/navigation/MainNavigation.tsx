"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActiveRouteIndicator } from "@/components/navigation/ActiveRouteIndicator";
import { isNavigationItemActive, type NavigationItem } from "@/components/navigation/navigationItems";

export function MainNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="main-navigation" aria-label="Main navigation">
      {items.map((item) => {
        const active = isNavigationItemActive(pathname, item.href);

        return (
          <Link aria-current={active ? "page" : undefined} className="main-navigation__link" href={item.href} key={item.href}>
            <span>{item.label}</span>
            <ActiveRouteIndicator active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
