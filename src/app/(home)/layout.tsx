import type { ReactNode } from "react";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";
import HomePage from "./page";

export default function HomeLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RouteNoScriptFallback fallback={<HomePage />}>{children}</RouteNoScriptFallback>;
}
