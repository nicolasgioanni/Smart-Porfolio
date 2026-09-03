export const siteRoutes = {
  home: "/",
  experience: "/experience",
  research: "/research",
  projects: "/projects",
  recommendations: "/recommendations",
  resume: "/resume",
  contact: "/contact",
  terms: "/terms",
  privacy: "/privacy",
  security: "/security"
} as const;

export type SiteRoutePath = (typeof siteRoutes)[keyof typeof siteRoutes];

export const siteRoutePaths = Object.values(siteRoutes) as SiteRoutePath[];

export const siteRouteIndexing = {
  [siteRoutes.home]: true,
  [siteRoutes.experience]: true,
  [siteRoutes.research]: true,
  [siteRoutes.projects]: true,
  [siteRoutes.recommendations]: true,
  [siteRoutes.resume]: true,
  [siteRoutes.contact]: false,
  [siteRoutes.terms]: true,
  [siteRoutes.privacy]: true,
  [siteRoutes.security]: true
} as const satisfies Readonly<Record<SiteRoutePath, boolean>>;

export type IndexableSiteRoutePath = {
  [Path in SiteRoutePath]: (typeof siteRouteIndexing)[Path] extends true ? Path : never;
}[SiteRoutePath];

export type NonIndexableSiteRoutePath = Exclude<SiteRoutePath, IndexableSiteRoutePath>;

export const indexableSiteRoutePaths = Object.freeze(
  siteRoutePaths.filter((pathname): pathname is IndexableSiteRoutePath => siteRouteIndexing[pathname])
);

export const nonIndexableSiteRoutePaths = Object.freeze(
  siteRoutePaths.filter((pathname): pathname is NonIndexableSiteRoutePath => !siteRouteIndexing[pathname])
);

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

export function isIndexableSiteRoutePath(pathname: string): pathname is IndexableSiteRoutePath {
  return isSiteRoutePath(pathname) && siteRouteIndexing[pathname];
}
