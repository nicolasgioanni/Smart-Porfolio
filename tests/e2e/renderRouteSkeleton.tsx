import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { siteRoutePaths, siteRoutes, type SiteRoutePath } from "../../src/lib/routing/siteRoutes";
import { canonicalResearchSkeletonItems } from "../fixtures/researchSkeletonContent";
import { canonicalHomeProjectSkeletonItems, canonicalProjectSkeletonItems } from "../fixtures/projectSkeletonContent";

// This isolated server renderer uses tsx, which needs the classic JSX runtime
// made available before it imports the app's automatic-runtime component graph.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const { RouteSkeleton } = await import("../../src/components/loading/RouteSkeleton");

const markupByRoute = Object.fromEntries(
  siteRoutePaths.map((pathname) => [
    pathname,
    renderToStaticMarkup(
      createElement(RouteSkeleton, {
        pathname,
        homeProjectItems: pathname === siteRoutes.home ? canonicalHomeProjectSkeletonItems : undefined,
        projectDetailItems: pathname === siteRoutes.projects ? canonicalProjectSkeletonItems : undefined,
        researchDetailItems: pathname === siteRoutes.research ? canonicalResearchSkeletonItems : undefined
      })
    )
  ])
) as Readonly<Record<SiteRoutePath, string>>;

process.stdout.write(JSON.stringify(markupByRoute));
