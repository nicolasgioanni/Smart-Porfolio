"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { siteRoutes } from "@/lib/routing/siteRoutes";

type ResearchNoScriptRouteGateProps = {
  children: ReactNode;
  fallback: ReactNode;
};

/**
 * The streamed route loader is useful after hydration, but an exported page
 * with JavaScript disabled needs its already-rendered Research body instead.
 * Keep the normal route body as a direct main child for motion and skeleton
 * contracts; the noscript rule only applies while scripting is unavailable.
 */
export function ResearchNoScriptRouteGate({ children, fallback }: ResearchNoScriptRouteGateProps) {
  const pathname = usePathname();

  return (
    <>
      {pathname === siteRoutes.research ? (
        <noscript>
          <style>{`.site-main > :not(noscript) { display: none !important; }`}</style>
          {fallback}
        </noscript>
      ) : null}
      {children}
    </>
  );
}
