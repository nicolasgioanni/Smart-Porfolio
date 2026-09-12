import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SiteRoutePath } from "../../src/lib/routing/siteRoutes";

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(helperDirectory, "..", "..");
const rendererPath = path.join(helperDirectory, "renderRouteSkeleton.tsx");

// Keep the component render authoritative while caching its serialized result
// once per Playwright worker rather than once per screenshot case.
const serializedMarkup = execFileSync(process.execPath, ["--import", "tsx", rendererPath], {
  cwd: projectRoot,
  encoding: "utf8"
});

export const skeletonMarkupByRoute = JSON.parse(serializedMarkup) as Readonly<Record<SiteRoutePath, string>>;
