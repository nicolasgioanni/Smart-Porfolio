import { siteRoutes, type SiteRoutePath } from "@/components/navigation/siteRoutes";
import type { ProfileContent } from "@/content/types";

export type RouteHeaderContent = {
  accessory: "detail-level" | "none";
  description: string;
  eyebrow?: string;
  placement: "embedded" | "page";
  title: string;
};

export type RouteHeaderContentSource = {
  profile: Pick<ProfileContent, "experienceSummary">;
};

/**
 * Static, loader-safe copy for every page-level header.
 *
 * The Experience fallback lives beside every other stable route header. The
 * server resolver below accepts the validated generated Experience summary so
 * an enabled content override stays identical in the resolved page and loader.
 */
export const routeHeaderContent = {
  [siteRoutes.home]: null,
  [siteRoutes.experience]: {
    accessory: "detail-level",
    description:
      "My experience spans AI engineering at the U.S. Treasury, research software and machine learning at the University of Washington, and teaching core computer science courses.",
    placement: "embedded",
    title: "Experience"
  },
  [siteRoutes.research]: {
    accessory: "detail-level",
    description:
      "My research centers on CytoCV and adversarial machine learning, with additional work in computational biology automation.",
    placement: "embedded",
    title: "Applied AI Research"
  },
  [siteRoutes.projects]: {
    accessory: "none",
    description: "I build practical tools for learning, file organization, and developer automation—explore the projects below.",
    placement: "page",
    title: "Projects"
  },
  [siteRoutes.recommendations]: {
    accessory: "none",
    description: "Read how professors, managers, and teammates describe my engineering, collaboration, and communication below.",
    placement: "page",
    title: "Recommendations"
  },
  [siteRoutes.resume]: {
    accessory: "none",
    description: "My resume is private and shared directly with legitimate professional contacts.",
    placement: "page",
    title: "Resume"
  },
  [siteRoutes.contact]: {
    accessory: "none",
    description:
      "My University of Washington inbox is public and receives a high volume of email. For the fastest response and priority review, send a quick request through this form.",
    placement: "page",
    title: "Contact"
  },
  [siteRoutes.terms]: {
    accessory: "none",
    description: "How portfolio information may be used, verified, and attributed.",
    eyebrow: "Site notice",
    placement: "page",
    title: "Site Terms & Accuracy Notice"
  },
  [siteRoutes.privacy]: {
    accessory: "none",
    description: "What information may be processed when you visit this portfolio or choose to make contact.",
    eyebrow: "Site notice",
    placement: "page",
    title: "Privacy Notice"
  },
  [siteRoutes.security]: {
    accessory: "none",
    description: "How to report a suspected portfolio security issue without disrupting visitors or third-party services.",
    eyebrow: "Site notice",
    placement: "page",
    title: "Security & Responsible Disclosure"
  }
} as const satisfies Readonly<Record<SiteRoutePath, RouteHeaderContent | null>>;

export function getRouteHeaderContent(pathname: SiteRoutePath): RouteHeaderContent | null {
  return routeHeaderContent[pathname];
}

/** Resolves the only generated header override without making other routes data-driven. */
export function resolveRouteHeaderContent(
  pathname: SiteRoutePath,
  source?: RouteHeaderContentSource
): RouteHeaderContent | null {
  const fallback = routeHeaderContent[pathname];
  if (!fallback || pathname !== siteRoutes.experience || !source?.profile.experienceSummary) return fallback;

  return { ...fallback, description: source.profile.experienceSummary };
}
