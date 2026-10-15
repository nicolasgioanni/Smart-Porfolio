import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import ExperiencePage from "./page";

export default function ExperienceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<ExperiencePage />}>{children}</RouteNoScriptFallback>;
}
