import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";

type ResearchNoScriptRouteGateProps = {
  children: ReactNode;
  fallback: ReactNode;
};

/**
 * Preserve the direct Research route body while retaining native media when
 * scripting is unavailable.
 */
export function ResearchNoScriptRouteGate({ children, fallback }: ResearchNoScriptRouteGateProps) {
  return <RouteNoScriptFallback fallback={fallback}>{children}</RouteNoScriptFallback>;
}
