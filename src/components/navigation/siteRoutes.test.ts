import { describe, expect, it } from "vitest";
import {
  indexableSiteRoutePaths,
  isIndexableSiteRoutePath,
  nonIndexableSiteRoutePaths,
  siteRouteIndexing,
  siteRoutePaths
} from "@/components/navigation/siteRoutes";

const approvedIndexableRoutes = [
  "/",
  "/experience",
  "/research",
  "/projects",
  "/recommendations",
  "/resume",
  "/terms",
  "/privacy",
  "/security"
];

describe("site route indexing classification", () => {
  it("declares exactly the nine approved indexable routes", () => {
    expect(indexableSiteRoutePaths).toEqual(approvedIndexableRoutes);
    expect(indexableSiteRoutePaths).toHaveLength(9);
    approvedIndexableRoutes.forEach((pathname) => expect(isIndexableSiteRoutePath(pathname)).toBe(true));
  });

  it("declares contact as the only non-indexable route", () => {
    expect(nonIndexableSiteRoutePaths).toEqual(["/contact"]);
    expect(isIndexableSiteRoutePath("/contact")).toBe(false);
  });

  it("classifies every registered route exactly once", () => {
    const classifiedRoutes = [...indexableSiteRoutePaths, ...nonIndexableSiteRoutePaths];

    expect(Object.keys(siteRouteIndexing)).toEqual(siteRoutePaths);
    expect(new Set(classifiedRoutes).size).toBe(classifiedRoutes.length);
    expect(new Set(classifiedRoutes)).toEqual(new Set(siteRoutePaths));

    for (const pathname of siteRoutePaths) {
      const membershipCount = Number(indexableSiteRoutePaths.includes(pathname as never)) +
        Number(nonIndexableSiteRoutePaths.includes(pathname as never));
      expect(membershipCount).toBe(1);
      expect(isIndexableSiteRoutePath(pathname)).toBe(siteRouteIndexing[pathname]);
    }
  });
});
