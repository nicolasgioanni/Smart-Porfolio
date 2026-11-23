// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createImpactPlan, parseImpactPlan } from "./impact.mjs";

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const plan = (changedPaths, extra = {}) => createImpactPlan({ changedPaths, baseSha, headSha, ...extra });

describe("provider-neutral impact policy", () => {
  it("admits only ordinary documentation to the docs gate", () => {
    expect(plan(["README.md", "docs/quality/TESTING.md"])).toMatchObject({ tier: "docs", validators: ["quality", "security"], chromiumSpecs: [] });
    expect(plan(["docs/example.js"]).tier).toBe("full");
  });
  it("includes route and static navigation plus all skeleton contracts for feature UI", () => {
    const result = plan(["src/features/research/components/ResearchCard.tsx", "src/features/projects/projects.css"]);
    expect(result.tier).toBe("targeted");
    expect(result.features).toEqual(["projects", "research"]);
    expect(result.validators).toEqual(["build-export", "chromium-1", "chromium-2", "cross-browser", "quality", "security", "unit", "visual"]);
    expect(result.chromiumSpecs).toEqual(expect.arrayContaining(["tests/e2e/projects.spec.ts", "tests/e2e/research.spec.ts", "tests/e2e/research-mobile-video.spec.ts", "tests/e2e/navigation.spec.ts", "tests/e2e/progressiveEnhancement.spec.ts", "tests/e2e/skeleton-alignment.spec.ts", "tests/e2e/skeletons.transition.spec.ts"]));
    expect(plan([...new Set(["src/features/projects/projects.css", "src/features/research/components/ResearchCard.tsx"])])).toEqual(result);
    expect(plan(["src/features/projects/projects.css"]).validators).toContain("cross-browser");
    expect(plan(["src/features/research/ResearchCard.tsx"]).validators).toContain("cross-browser");
    expect(plan(["src/features/experience/ExperienceCard.tsx"]).validators).not.toContain("cross-browser");
  });
  it.each(["src/components/overlay/ModalDialog.tsx", "src/app/page.tsx", "src/lib/content/parse.ts", "src/features/research/content/researchVideos.ts", "src/features/contact/components/ContactForm.tsx", "src/features/projects/components/New.test.tsx", "tests/e2e/new.spec.ts", "package-lock.json", ".circleci/config.yml", "infra/main.tf", "public/data.json", "unrecognized.md"])('fails closed for %s', (path) => {
    const result = plan([path]);
    expect(result.tier).toBe("full");
    expect(result.chromiumSpecs).toEqual(["*"]);
    expect(result.validators).toHaveLength(9);
  });
  it.each(["docs/security/SECURITY.md", "docs/operations/DEPLOYMENT.md", "docs/quality/CI_CONTRACTS.md", "AGENTS.md", ".agents/README.md"])("requires full validation for policy documentation %s", (path) => {
    expect(plan([path]).tier).toBe("full");
  });
  it("binds and verifies all canonical inputs and outputs", () => {
    const result = plan(["src/features/projects/projects.css", "README.md", "README.md"]);
    expect(result).toMatchObject({ policyVersion: 1, changedPaths: ["README.md", "src/features/projects/projects.css"], trigger: "pull_request", forceFull: false });
    expect(parseImpactPlan(result)).toEqual(result);
    for (const patch of [
      { tier: "docs" }, { policyVersion: 2 }, { validators: ["quality"] },
      { chromiumSpecs: [] }, { reasons: [] }, { features: [] },
      { changedPaths: [...result.changedPaths].reverse() }, { trigger: "push" },
      { forceFull: true }, { extra: true }, { baseSha: "bad" },
    ]) expect(() => parseImpactPlan({ ...result, ...patch })).toThrow();
    expect(() => parseImpactPlan(null)).toThrow();
    expect(() => plan(["a".repeat(4097)])).toThrow();
    expect(() => plan(Array(10001).fill("README.md"))).toThrow();
  });
  it("treats each side of renames and deleted files as changed paths", () => {
    expect(plan(["src/features/projects/components/Old.tsx", "src/components/Old.tsx"]).tier).toBe("full");
    expect(plan(["src/features/projects/components/Deleted.tsx"]).tier).toBe("targeted");
  });
  it("never treats an empty diff, non-PR trigger or explicit force as a no-op", () => {
    expect(plan([]).tier).toBe("full");
    for (const trigger of ["push", "main", "develop", "tag", "schedule", "workflow_dispatch", "unknown"]) expect(plan(["README.md"], { trigger }).tier).toBe("full");
    expect(plan(["README.md"], { forceFull: true }).tier).toBe("full");
  });
  it("rejects malformed revisions and unsafe or ambiguous paths", () => {
    for (const path of ["", "/src/a", "../src/a", "src/../a", "src//a", "src\\a", "src/a\nother", { old: "x", new: "y" }]) expect(() => plan([path])).toThrow();
    for (const sha of ["abc", "A".repeat(40), "g".repeat(40), null]) expect(() => plan(["README.md"], { baseSha: sha })).toThrow();
    expect(() => plan(null)).toThrow();
    expect(() => plan(["README.md"], { forceFull: "false" })).toThrow();
  });
});
