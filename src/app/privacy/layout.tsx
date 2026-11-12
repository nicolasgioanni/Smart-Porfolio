import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import PrivacyPage from "./page";

export default function PrivacyLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<PrivacyPage />}>{children}</RouteNoScriptFallback>;
}
