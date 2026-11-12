import type { PortfolioContentLink } from "@/content/types";
import { getLinkKind } from "@/lib/content/displayHelpers";

export type ProjectAction = {
  label: "Source code" | "Live demo" | "Download";
  link: PortfolioContentLink;
};

const projectActionOrder: ReadonlyArray<{ kind: string; label: ProjectAction["label"] }> = [
  { kind: "github", label: "Source code" },
  { kind: "website", label: "Live demo" },
  { kind: "download", label: "Download" }
];

/** Selects configured source, live, and release destinations in a stable presentation order. */
export function getProjectActions(links: readonly PortfolioContentLink[]): ProjectAction[] {
  return projectActionOrder.flatMap(({ kind, label }) => {
    const link = links.find((candidate) => getProjectLinkKind(candidate) === kind);
    return link ? [{ label, link }] : [];
  });
}

/** Project releases are downloads before GitHub is considered a source destination. */
function getProjectLinkKind(link: PortfolioContentLink): string {
  const label = link.label.toLowerCase();
  if (/\b(download|release|installer)\b/.test(label) || isGitHubReleaseUrl(link.url)) return "download";
  return getLinkKind(link);
}

function isGitHubReleaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    return url.hostname === "github.com" && segments.length >= 3 && segments[2] === "releases";
  } catch {
    return false;
  }
}

/** A preview opens the real deployment first, then a release, then its source. */
export function getProjectPreviewAction(links: readonly PortfolioContentLink[]): ProjectAction | undefined {
  const actions = getProjectActions(links);
  return actions.find((action) => action.label === "Live demo") ?? actions.find((action) => action.label === "Download") ?? actions.find((action) => action.label === "Source code");
}

export function getProjectDiagramAction(links: readonly PortfolioContentLink[]): ProjectAction | undefined {
  return getProjectActions(links).find((action) => action.label === "Source code");
}

export function getProjectDestinationHint(action: ProjectAction | undefined): string {
  if (action?.label === "Live demo") return "Open live site";
  if (action?.label === "Download") return "View release";
  if (action?.label === "Source code") return "View source";
  return "";
}
