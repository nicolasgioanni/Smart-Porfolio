import type { PortfolioContentLink, PortfolioLink } from "@/content/types";

export function limitItems<TItem>(items: TItem[], maxItems: number): TItem[] {
  return items.slice(0, Math.max(0, maxItems));
}

export function getSummary(primary?: string, fallback?: string): string | undefined {
  return primary?.trim() || fallback?.trim() || undefined;
}

export function getLinkKind(link: Pick<PortfolioLink | PortfolioContentLink, "label" | "url">): string {
  const label = link.label.toLowerCase();
  const url = link.url.toLowerCase();

  if (label.includes("github") || url.includes("github.com")) return "github";
  if (label.includes("linkedin") || url.includes("linkedin.com")) return "linkedin";
  if (["repository", "source", "github_repository"].some((kind) => label.includes(kind) || url.includes(kind))) return "github";
  if (url.startsWith("mailto:")) return "email";
  if (label.includes("resume") || url.includes("resume")) return "resume";
  if (label.includes("demo")) return "website";
  if (label.includes("paper") || label.includes("publication")) return "publication";

  return "external";
}

export function getExternalLinkProps(url: string): { target?: string; rel?: string } {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { target: "_blank", rel: "noopener noreferrer" };
  }

  return {};
}
