import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import TermsPage from "./page";

export default function TermsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<TermsPage />}>{children}</RouteNoScriptFallback>;
}
