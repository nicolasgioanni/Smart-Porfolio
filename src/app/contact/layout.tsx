import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import ContactPage from "./page";

export default function ContactLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<ContactPage />}>{children}</RouteNoScriptFallback>;
}
