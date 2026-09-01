import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { siteRoutePaths, type SiteRoutePath } from "../../src/components/navigation/siteRoutes";

// Next compiles the app with the automatic runtime, while this isolated
// server renderer uses the classic runtime through tsx.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const { RouteSkeleton } = await import("../../src/components/loading/RouteSkeleton");

const markupByRoute = Object.fromEntries(
  siteRoutePaths.map((pathname) => [pathname, renderToStaticMarkup(createElement(RouteSkeleton, { pathname }))])
) as Readonly<Record<SiteRoutePath, string>>;

process.stdout.write(JSON.stringify(markupByRoute));
