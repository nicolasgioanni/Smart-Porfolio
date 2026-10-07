import type { PortfolioContentLink } from "@/content/types";
import { getLinkKind } from "@/lib/content/displayHelpers";

export type ProjectAction = {
  label: "Source code" | "Live demo";
  link: PortfolioContentLink;
};

const projectActionOrder: ReadonlyArray<{ kind: string; label: ProjectAction["label"] }> = [
  { kind: "github", label: "Source code" },
  { kind: "website", label: "Live demo" }
];

/** Selects configured source and demo destinations in their shared presentation order. */
export function getProjectActions(links: readonly PortfolioContentLink[]): ProjectAction[] {
  return projectActionOrder.flatMap(({ kind, label }) => {
    const link = links.find((candidate) => getLinkKind(candidate) === kind);
    return link ? [{ label, link }] : [];
  });
}
