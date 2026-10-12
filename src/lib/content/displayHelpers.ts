import type { PortfolioContentLink, PortfolioLink } from "@/content/types";

function hostnameFor(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function hasHostname(hostname: string | undefined, expected: string): boolean {
  return hostname === expected || hostname?.endsWith(`.${expected}`) === true;
}

function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function limitItems<TItem>(items: TItem[], maxItems: number): TItem[] {
  return items.slice(0, Math.max(0, maxItems));
}

export function getSummary(primary?: string, fallback?: string): string | undefined {
  return primary?.trim() || fallback?.trim() || undefined;
}

export function getLinkKind(link: Pick<PortfolioLink | PortfolioContentLink, "label" | "url">): string {
  const label = link.label.toLowerCase();
  const url = link.url.toLowerCase();
  const hostname = hostnameFor(url);

  if (label.includes("github") || hasHostname(hostname, "github.com")) return "github";
  if (label.includes("linkedin") || hasHostname(hostname, "linkedin.com")) return "linkedin";
  if (["repository", "source", "github_repository"].some((kind) => label.includes(kind) || url.includes(kind))) return "github";
  if (url.startsWith("mailto:")) return "email";
  if (label.includes("resume") || url.includes("resume")) return "resume";
  if (["demo", "live site", "website"].some((kind) => label.includes(kind))) return "website";
  if (["paper", "manuscript", "publication"].some((kind) => label.includes(kind))) return "publication";

  return "external";
}

export function getExternalLinkProps(url: string): { target?: string; rel?: string } {
  if (isHttpUrl(url)) {
    return { target: "_blank", rel: "noopener noreferrer" };
  }

  return {};
}
