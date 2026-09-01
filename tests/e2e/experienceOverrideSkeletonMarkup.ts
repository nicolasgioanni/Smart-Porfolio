import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { experienceOverrideSummary } from "./experienceOverride";

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(helperDirectory, "..", "..");
const rendererPath = path.join(helperDirectory, "renderExperienceOverrideSkeleton.tsx");

export const experienceOverrideSkeletonMarkup = execFileSync(process.execPath, ["--import", "tsx", rendererPath], {
  cwd: projectRoot,
  encoding: "utf8"
});

export { experienceOverrideSummary };
