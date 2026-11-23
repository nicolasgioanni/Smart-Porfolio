import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import RecommendationsPage from "./page";

export default function RecommendationsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<RecommendationsPage />}>{children}</RouteNoScriptFallback>;
}
