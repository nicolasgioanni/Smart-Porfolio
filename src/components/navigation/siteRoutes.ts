export const siteRoutes = {
  home: "/",
  experience: "/experience",
  research: "/research",
  projects: "/projects",
  recommendations: "/recommendations",
  resume: "/resume"
} as const;

export type SiteRoutePath = (typeof siteRoutes)[keyof typeof siteRoutes];

export const siteRoutePaths = Object.values(siteRoutes) as SiteRoutePath[];

const siteRoutePathSet = new Set<string>(siteRoutePaths);

export function isSiteRoutePath(pathname: string): pathname is SiteRoutePath {
  return siteRoutePathSet.has(pathname);
}

export function getSiteRoutePath(href: string): SiteRoutePath | undefined {
  const suffixIndex = href.search(/[?#]/);
  const pathname = suffixIndex === -1 ? href : href.slice(0, suffixIndex);

  return isSiteRoutePath(pathname) ? pathname : undefined;
}

export function isSiteRouteHref(href: string): boolean {
  return getSiteRoutePath(href) !== undefined;
}
