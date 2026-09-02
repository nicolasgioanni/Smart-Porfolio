import { execFileSync } from "node:child_process";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const rendererPath = path.join(projectRoot, "tests", "e2e", "renderRouteSkeleton.tsx");

function getStandaloneResearchResourceCounts() {
  const renderedRoutes = JSON.parse(
    execFileSync(process.execPath, ["--import", "tsx", rendererPath], {
      cwd: projectRoot,
      encoding: "utf8"
    })
  );
  const document = new JSDOM(renderedRoutes["/research"]).window.document;

  return Array.from(document.querySelectorAll(".research-skeleton__resources"), (resources) =>
    resources.querySelectorAll(":scope > .skeleton-block").length
  );
}

describe("standalone route skeleton renderer", () => {
  it("locks Research visual markup to the canonical template resource footprint", () => {
    expect(getStandaloneResearchResourceCounts()).toEqual([4, 3, 1]);
  });
});
