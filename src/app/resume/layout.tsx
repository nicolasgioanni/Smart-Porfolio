import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import ResumePage from "./page";

export default function ResumeLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<ResumePage />}>{children}</RouteNoScriptFallback>;
}
