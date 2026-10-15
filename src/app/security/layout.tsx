import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import SecurityPage from "./page";

export default function SecurityLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<SecurityPage />}>{children}</RouteNoScriptFallback>;
}
