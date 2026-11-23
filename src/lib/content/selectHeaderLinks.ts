import type { PortfolioLink } from "@/content/types";
import { sortGeneric } from "@/lib/content/sortPortfolioContent";

/** Shared shell navigation is intentionally independent of Home composition. */
export function selectHeaderLinks(links: PortfolioLink[]): PortfolioLink[] {
  return sortGeneric(links.filter((link) => link.showInHeader)).slice(0, 4);
}
