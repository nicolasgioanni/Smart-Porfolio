"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { siteRoutes } from "@/lib/routing/siteRoutes";

type StaticPortfolioRouteGateProps = {
  children: ReactNode;
  homeFallback: ReactNode;
  projectsFallback: ReactNode;
  researchFallback: ReactNode;
};

/**
 * Static export can retain a streamed loading boundary when scripting is off.
 * These routes receive direct server-rendered native fallbacks.
 */
export function StaticPortfolioRouteGate({ children, homeFallback, projectsFallback, researchFallback }: StaticPortfolioRouteGateProps) {
  const pathname = usePathname();
  const routeFallback =
    pathname === siteRoutes.home
      ? homeFallback
      : pathname === siteRoutes.research
        ? researchFallback
        : pathname === siteRoutes.projects
          ? projectsFallback
          : null;

  return (
    <>
      {routeFallback ? (
        <noscript>
          <style>{`.site-main > :not(noscript) { display: none !important; }`}</style>
          {routeFallback}
        </noscript>
      ) : null}
      {children}
    </>
  );
}
