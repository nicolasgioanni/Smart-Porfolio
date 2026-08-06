import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { isSiteRouteHref } from "@/components/navigation/siteRoutes";
import { getExternalLinkProps } from "@/lib/content/displayHelpers";

export type SmartLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

function mergeRelValues(...values: Array<string | undefined>): string | undefined {
  const tokens = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);

  return tokens.length > 0 ? [...new Set(tokens)].join(" ") : undefined;
}

export function SmartLink({ href, rel, target, ...props }: SmartLinkProps) {
  const externalProps = getExternalLinkProps(href);
  const resolvedTarget = target ?? externalProps.target;
  const resolvedRel =
    resolvedTarget === "_blank" ? mergeRelValues(rel, externalProps.rel, "noopener noreferrer") : mergeRelValues(rel);

  if (isSiteRouteHref(href)) {
    return <Link {...props} href={href} rel={resolvedRel} target={resolvedTarget} />;
  }

  return <a {...props} href={href} rel={resolvedRel} target={resolvedTarget} />;
}
