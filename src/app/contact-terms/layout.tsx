import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import ContactTermsPage from "./page";

export default function ContactTermsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<ContactTermsPage />}>{children}</RouteNoScriptFallback>;
}
