import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateWorkflowYaml } from "./ci/workflowYaml.mjs";
import { createArtifactManifest, verifyArtifactManifest } from "./artifactIntegrity.mjs";
import { resolvePagesDeploymentUrl } from "./checkDeployedContent.mjs";
import {
  priorityTestDirectories,
  priorityTestTargets,
  requiredPriorityFiles
} from "./runValidationTier.mjs";
import { sealedRuntimeConfigContracts } from "./release/runtimeConfig.mjs";
import { readContentVersion, writeContentVersion } from "./writeContentVersion.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workflowPath = path.join(projectRoot, ".github", "workflows", "ci.yml");
const candidateSha = "0123456789abcdef0123456789abcdef01234567";
const contentHash = "a".repeat(64);

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length;
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("package and CI deployment automation", () => {
  it("pins local Wrangler and writes content-version metadata after both build modes", async () => {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
    const nextConfigSource = await readFile(path.join(projectRoot, "next.config.mjs"), "utf8");
    const nvmVersion = (await readFile(path.join(projectRoot, ".nvmrc"), "utf8")).trim();

    expect(packageJson.engines.node).toBe(">=22.13.0");
    expect(nvmVersion).toBe("22");
    expect(packageJson.scripts.build).toBe("next build && node scripts/writeContentVersion.mjs");
    expect(packageJson.scripts["build:generated"]).toBe(
      "next build && node scripts/writeContentVersion.mjs"
    );
    expect(packageJson.scripts["release:build"]).toBe("node scripts/release.mjs build");
    expect(packageJson.scripts["release:compile"]).toBe("node scripts/release.mjs compile");
    expect(packageJson.scripts["release:package"]).toBe("node scripts/release.mjs package");
    expect(packageJson.scripts["release:runtime"]).toBe("node scripts/release.mjs runtime");
    expect(packageJson.scripts["test:e2e:release-static"]).toContain("playwright.release.config.ts");
    expect(nextConfigSource).toMatch(/adapterPath:\s*fileURLToPath\(new URL\("\.\/scripts\/nextBuildAdapter\.mjs"/);
    expect(nextConfigSource).toMatch(/output:\s*"export"/);
    expect(packageJson.scripts["dev:pages"]).toContain("npx --no-install wrangler");
    expect(packageJson.scripts["docs:check"]).toBe("node scripts/validateDocumentation.mjs");
    expect(packageJson.scripts["audit:check"]).toBe("node scripts/checkDependencyAudit.mjs");
    expect(packageJson.scripts["generate:content"]).toBe("node scripts/generateContent.mjs");
    expect(packageJson.scripts.verify).toBe("node scripts/runVerification.mjs verify");
    expect(packageJson.scripts["test:priority"]).toBe(
      "node scripts/runValidationTier.mjs priority"
    );
    expect(packageJson.dependencies.next).toBe("^16.4.0");
    expect(packageJson.devDependencies["@next/eslint-plugin-next"]).toBe("^16.4.0");
    expect(packageJson.devDependencies.wrangler).toBe("4.148.0");
    expect(packageJson.devDependencies.miniflare).toBe("5.20261006.0-alpha");
    expect(packageJson.devDependencies.yaml).toBe("2.9.1");
    expect(packageJson.devDependencies["js-yaml"]).toBeUndefined();
    expect(packageJson.devDependencies.vitest).toBe("4.1.11");
    expect(packageJson.devDependencies["@playwright/test"]).toMatch(/^\^1\./);
    expect(packageJson.scripts["test:footer"]).toBe(
      "vitest run src/components/layout/InteractiveBlobFooter.test.tsx src/components/layout/footerStyles.test.ts"
    );
    expect(packageJson.scripts["test:navigation"]).toBe(
      "vitest run src/components/navigation/MobileNavigation.test.tsx src/components/navigation/navigation.test.tsx src/components/navigation/navigationStyles.test.ts src/components/responsive/useMediaQuery.test.tsx src/components/theme/ThemeSwitcher.test.tsx"
    );
    expect(packageJson.scripts["test:skeletons"]).toBe(
      "vitest run src/components/loading/skeleton.test.tsx src/components/loading/skeletonStyles.test.ts src/components/loading/skeletonContentContract.test.ts src/features/research/loading/ResearchPageSkeleton.test.tsx scripts/renderRouteSkeleton.test.mjs src/components/motion/pageEntryStyles.test.ts"
    );
    expect(packageJson.scripts["test:e2e:navigation"]).toBe(
      "playwright test navigation.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:skeletons:alignment"]).toBe(
      "playwright test skeleton-alignment.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:skeletons:visual"]).toBe(
      "playwright test skeletons.visual.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:skeletons"]).toBe(
      "playwright test skeleton-alignment.spec.ts skeletons.transition.spec.ts skeletons.visual.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:skeleton-guidance"]).toBe(
      "vitest run scripts/skeletonGuidance.test.mjs"
    );
    expect(packageJson.scripts["test:quality:properties"]).toBe(
      "vitest run scripts/quality/contactBoundary.property.test.ts"
    );
    expect(packageJson.scripts["test:quality:mutations"]).toBe(
      "vitest run scripts/quality/contactGuardMutation.test.mjs"
    );
    expect(packageJson.scripts["test:quality:payload"]).toBe(
      "node scripts/quality/payloadBudget.mjs --out out --next .next"
    );
    expect(packageJson.scripts["test:e2e:footer"]).toBe(
      "playwright test footer.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:recommendations"]).toBe(
      "playwright test recommendations.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:experience"]).toBe(
      "playwright test experience.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:research"]).toBe(
      "playwright test research.spec.ts research-mobile-video.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:research:webkit"]).toBe(
      "playwright test research.spec.ts research-mobile-video.spec.ts --project=webkit-mobile --grep @mobile-video"
    );
    expect(packageJson.scripts["test:e2e:projects:webkit"]).toBe(
      "playwright test projects.spec.ts --project=webkit-mobile --grep @mobile-projects"
    );
    expect(packageJson.scripts["test:e2e:contact"]).toBe(
      "playwright test contact.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:accessibility"]).toBe(
      "playwright test accessibility.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:critical:firefox"]).toBe(
      "playwright test critical-quality.spec.ts --project=firefox-critical"
    );
    expect(packageJson.scripts["test:e2e:critical:webkit"]).toBe(
      "playwright test critical-quality.spec.ts --project=webkit-critical"
    );
    expect(packageJson.scripts["test:e2e:priority"]).toBe(
      "playwright test skeleton-alignment.spec.ts skeletons.transition.spec.ts navigation.spec.ts progressiveEnhancement.spec.ts footer.spec.ts contact.spec.ts recommendations.spec.ts experience.spec.ts projects.spec.ts research.spec.ts research-mobile-video.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:full"]).toBe(
      "playwright test --project=chromium"
    );
    expect(packageJson.scripts["verify:priority"]).toBe("node scripts/runVerification.mjs priority");
    expect(packageJson.scripts["verify:full"]).toBe("node scripts/runVerification.mjs full");
  });

  it("keeps priority coverage on trust boundaries and lets the full browser suite discover every specification", async () => {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
    expect(packageJson.scripts["test:priority"]).toBe("node scripts/runValidationTier.mjs priority");
    expect(priorityTestTargets).toContain("functions");
    expect(priorityTestTargets).toContain("scripts/permanentBranchRuleset.test.mjs");
    expect(priorityTestDirectories).toEqual([
      "scripts/ci",
      "scripts/security",
      "src/components/overlay",
      "src/features/home",
      "src/features/contact",
      "src/features/legal",
      "src/features/skills",
      "src/features/experience",
      "src/features/projects",
      "src/features/recommendations",
      "src/components/portfolio/shared",
      "src/components/theme",
      "src/features/research",
      "src/lib/theme"
    ]);
    expect(requiredPriorityFiles).toEqual(
      expect.arrayContaining([
        "functions/api/contact.test.ts",
        "functions/api/contact/verify.test.ts",
        "scripts/checkDependencyAudit.test.mjs",
        "scripts/candidateAdmissionWorkflow.test.mjs",
        "scripts/security/checkSarif.test.mjs",
        "scripts/ci/gate.test.mjs",
        "scripts/heartbeatWorkflow.test.mjs",
        "scripts/security/installPinnedTool.test.mjs",
        "scripts/security/securityScans.test.mjs",
        "scripts/portfolioContentGeneration.test.ts",
        "src/lib/content/content.test.ts",
        "src/lib/content/security.test.ts",
        "src/lib/media/researchVideoAssets.test.ts",
        "src/lib/theme/themeTransition.test.ts",
        "src/styles/themePalette.test.ts",
        "src/components/portfolio/shared/DetailDisclosureList.test.tsx",
        "src/components/portfolio/shared/detailDisclosureStyles.test.ts",
        "src/features/experience/components/ExperienceShowcase.test.tsx",
        "src/features/projects/components/ProjectSkillShowcase.test.tsx",
        "src/features/projects/components/ProjectShowcase.test.tsx",
        "src/features/recommendations/components/RecommendationsList.test.tsx",
        "src/features/research/components/ResearchShowcase.test.tsx",
        "src/components/overlay/ModalDialog.test.tsx"
      ])
    );

    expect(packageJson.scripts["test:e2e:full"]).toBe("playwright test --project=chromium");
  });

  it("enforces the real parallel graph while preserving event and required-check identities", async () => {
    const workflow = validateWorkflowYaml(await readFile(workflowPath, "utf8"));
    expect(workflow.on.push.branches).toEqual(["main", "develop"]);
    expect(workflow.on.pull_request.branches).toEqual(["main", "develop"]);
    expect(workflow.on.schedule).toEqual([{ cron: "17 13 * * *" }]);
    expect(workflow.on.workflow_dispatch.inputs.force_deploy).toMatchObject({ type: "boolean", default: true });
    expect(workflow.jobs.verify.steps.some((step) => step.run === "node scripts/ci/run.mjs verify")).toBe(true);
    expect(workflow.jobs.verify.steps.some((step) => /npm ci|vitest|playwright test/.test(step.run ?? ""))).toBe(false);
    expect(workflow.jobs["unit-integration"].steps.some((step) => step.run === "npm test")).toBe(true);
    expect(workflow.jobs.quality.steps.map((step) => step.run ?? "").join("\n")).toMatch(/docs:check[\s\S]*lint[\s\S]*typecheck/);
    const metrics = workflow.jobs.verify.steps.find((step) => step.run === "node scripts/ci/metrics.mjs");
    expect(metrics.if).toBe("always()");
    expect(metrics["continue-on-error"]).toBe(true);
    expect(workflow.jobs.verify.outputs.accepted).toBe("${{ steps.gate.outputs.accepted }}");
    expect(workflow.jobs.verify.steps.find((step) => step.id === "gate")["continue-on-error"]).toBeUndefined();
    const audit = workflow.jobs["security-scans"].steps.filter((step) => step.run === "npm run audit:check");
    expect(audit).toHaveLength(1);
    expect(audit[0].if).toBeUndefined();
    expect(audit[0]["continue-on-error"]).toBeUndefined();
    expect(workflow.jobs["security-scans"].if).toBeUndefined();
    expect(workflow.jobs.quality.steps.some((step) => (step.run ?? "").includes("audit:check"))).toBe(false);
    const toolRuns = workflow.jobs["security-tools"].steps.map((step) => step.run ?? "").join("\n");
    expect(toolRuns).toContain("-shellcheck ''");
    expect(toolRuns).toContain("-pyflakes ''");
    expect(toolRuns).not.toMatch(/\.github\/workflows\/[^\s]+\.ya?ml/);
  });

  it("isolates one prepared snapshot and preserves credential-free PR validation", async () => {
    const workflow = validateWorkflowYaml(await readFile(workflowPath, "utf8"));
    const preparation = workflow.jobs["prepare-content"];
    const step = preparation.steps.find((step) => step.run === "node scripts/ci/run.mjs prepare");
    expect(step.env.PORTFOLIO_WORKBOOK_URL).toContain("github.event_name != 'pull_request'");
    expect(step.env.PORTFOLIO_WORKBOOK_URL).toContain("outputs.obsolete != 'true'");
    expect(step.env.PORTFOLIO_WORKBOOK_URL).toContain("|| ''");
    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (name === "deploy" || name === "prepare-content") continue;
      expect(JSON.stringify(job)).not.toContain("secrets.");
      expect(job.environment).toBeUndefined();
    }
    for (const job of ["quality", "unit-integration", "browser-e2e", "visual-regression", "cross-browser", "build-and-package", "export-check"]) {
      expect(workflow.jobs[job].env.CI_SNAPSHOT_REFERENCE).toContain("outputs.snapshot_reference");
      expect(JSON.stringify(workflow.jobs[job])).not.toMatch(/generate:content|npm run build(?=["\s])/);
    }
    expect(preparation.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toContain("vars.");
    expect(preparation.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY).toContain("vars.");
  });

  it("pins every action and confines write authority to its required boundary", async () => {
    const workflow = validateWorkflowYaml(await readFile(workflowPath, "utf8"));
    expect(workflow.permissions).toEqual({ contents: "read" });
    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (job.permissions?.contents === "write") expect(name).toBe("heartbeat");
      if (job.permissions?.["security-events"] === "write") expect(name).toBe("codeql");
      if (job.permissions?.["id-token"] === "write" || job.permissions?.attestations === "write") expect(name).toBe("deploy");
      for (const step of job.steps) {
        if (step.uses) expect(step.uses).toMatch(/^[^@]+@[a-f0-9]{40}$/);
        if (step.uses?.startsWith("actions/checkout@")) expect(step.with["persist-credentials"]).toBe(false);
        if (step.run === "node scripts/ci/metrics.mjs") expect(step["continue-on-error"]).toBe(true);
        else expect(step["continue-on-error"]).toBeUndefined();
      }
    }
    expect(workflow.jobs.codeql.steps.find((step) => step.uses?.startsWith("github/codeql-action/init@")).with).toMatchObject({ "build-mode": "none", queries: "security-extended" });
    expect(workflow.jobs.codeql.steps.find((step) => step.uses?.startsWith("github/codeql-action/analyze@")).with.upload).toBe("never");
    expect(workflow.jobs.heartbeat.if).toBe("github.event_name == 'schedule'");
    expect(workflow.jobs.heartbeat.steps.find((step) => step.uses?.startsWith("actions/checkout@")).with.ref).toBe("develop");
  });

  it("keeps acceptance, signing and serialized deployment in one candidate graph", async () => {
    const workflow = validateWorkflowYaml(await readFile(workflowPath, "utf8"));
    const deploy = workflow.jobs.deploy;
    expect(deploy.if).toContain("!cancelled()");
    expect(deploy.if).toContain("needs.verify.result == 'success'");
    expect(deploy.if).toContain("needs.verify.outputs.deploy == 'true'");
    expect(deploy.if).toContain("github.event_name != 'pull_request'");
    expect(deploy.concurrency["cancel-in-progress"]).toBe(false);
    const prepare = deploy.steps.findIndex((step) => step.run === "node scripts/ci/run.mjs deployment-prepare");
    const attest = deploy.steps.findIndex((step) => step.uses?.startsWith("actions/attest-build-provenance@"));
    const mutate = deploy.steps.findIndex((step) => step.run === "node scripts/ci/run.mjs deploy");
    expect(prepare).toBeGreaterThan(-1);
    expect(attest).toBeGreaterThan(prepare);
    expect(mutate).toBeGreaterThan(attest);
    expect(deploy.env.CI_ACCEPTANCE).toContain("needs.verify.outputs.acceptance");
    expect(deploy.env.CI_RELEASE_REFERENCE).toContain("outputs.release_reference");
    expect(deploy.steps[mutate].env.CLOUDFLARE_API_TOKEN).toContain("secrets.");
    expect(deploy.environment).toBeUndefined(); // activation is a separate operational change
  });

  it("sets no-cache headers for both deployment metadata files", async () => {
    const headers = await readFile(path.join(projectRoot, "public", "_headers"), "utf8");

    for (const metadataPath of ["/content-version.json", "/artifact-integrity.json"]) {
      const metadataHeaders = section(headers, metadataPath, metadataPath === "/content-version.json" ? "/artifact-integrity.json" : undefined);
      expect(metadataHeaders).toContain("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
      expect(metadataHeaders).toContain("Pragma: no-cache");
    }
  });

  it("keeps secrets out of tracked production and preview Pages variables", async () => {
    const wranglerConfig = JSON.parse(await readFile(path.join(projectRoot, "wrangler.jsonc"), "utf8"));
    const serializedConfig = JSON.stringify(wranglerConfig);

    for (const secretName of sealedRuntimeConfigContracts.runtimeSecrets) {
      expect(serializedConfig).not.toContain(secretName);
    }
    expect(wranglerConfig.vars.TURNSTILE_ALLOWED_HOSTNAMES).toBe(
      "smart-portfolio-bds.pages.dev,nicolasmgioanni.dev,www.nicolasmgioanni.dev"
    );
    expect(wranglerConfig.vars.CONTACT_ALLOWED_ORIGINS).toBe(
      "https://smart-portfolio-bds.pages.dev,https://nicolasmgioanni.dev,https://www.nicolasmgioanni.dev"
    );
    expect(wranglerConfig.vars.CONTACT_FROM_EMAIL).toBe(
      "Nicolas Gioanni <noreply@mail.nicolasmgioanni.dev>"
    );
    expect(wranglerConfig.env.preview.vars.TURNSTILE_ALLOWED_HOSTNAMES).toBe(
      "develop.smart-portfolio-bds.pages.dev"
    );
    expect(wranglerConfig.env.preview.vars.CONTACT_ALLOWED_ORIGINS).toBe(
      "https://develop.smart-portfolio-bds.pages.dev"
    );
    expect(wranglerConfig.env.preview.vars.CONTACT_FROM_EMAIL).toBe(
      "Nicolas Gioanni <noreply@mail.nicolasmgioanni.dev>"
    );
  });

  it("resolves the assigned Cloudflare Pages domain independently from the project name", () => {
    expect(resolvePagesDeploymentUrl("smart-portfolio-bds.pages.dev", "main")).toBe(
      "https://smart-portfolio-bds.pages.dev"
    );
    expect(resolvePagesDeploymentUrl("smart-portfolio-bds.pages.dev", "develop")).toBe(
      "https://develop.smart-portfolio-bds.pages.dev"
    );

    for (const invalidDomain of [
      "",
      "smart-portfolio.pages.dev/path",
      "https://smart-portfolio-bds.pages.dev",
      "SMART-PORTFOLIO-BDS.pages.dev",
      "smart-portfolio-bds.example.com"
    ]) {
      expect(() => resolvePagesDeploymentUrl(invalidDomain, "main")).toThrow(/pages\.dev hostname/);
    }
    expect(() => resolvePagesDeploymentUrl("smart-portfolio-bds.pages.dev", "feature")).toThrow(
      /main or develop/
    );
  });

  it("creates and verifies a source-bound SHA-256 artifact manifest", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "portfolio-artifact-test-"));
    const generatedContentPath = path.join(temporaryRoot, "portfolio.generated.json");
    const artifactDirectory = path.join(temporaryRoot, "out");

    try {
      await mkdir(artifactDirectory);
      await writeFile(
        generatedContentPath,
        `${JSON.stringify({ metadata: { contentHash, generatedAt: "2026-08-27T00:00:00.000Z" } })}\n`,
        "utf8"
      );
      await writeFile(path.join(artifactDirectory, "index.html"), "<!doctype html><title>Verified</title>", "utf8");
      await writeFile(path.join(artifactDirectory, ".nojekyll"), "", "utf8");
      await writeContentVersion({
        generatedContentPath,
        outputPath: path.join(artifactDirectory, "content-version.json"),
        environment: { DEPLOYMENT_COMMIT_SHA: candidateSha },
        identity: {
          target: "local",
          publicBuildInputDigest: "b".repeat(64),
          producer: { kind: "local", runId: "local", runNumber: null, attempt: null }
        }
      });

      const manifest = await createArtifactManifest(artifactDirectory);
      expect(Object.keys(manifest).sort()).toEqual(["algorithm", "commitSha", "files", "schemaVersion"]);
      expect(manifest.algorithm).toBe("sha256");
      expect(manifest.commitSha).toBe(candidateSha);
      expect(manifest.files.map((file) => file.path)).toContain(".nojekyll");
      expect(manifest.files.map((file) => file.path)).toContain("content-version.json");
      for (const file of manifest.files) {
        expect(Object.keys(file).sort()).toEqual(["path", "sha256", "size"]);
        expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      }
      await expect(verifyArtifactManifest(artifactDirectory, candidateSha)).resolves.toBeDefined();

      const version = await readContentVersion(path.join(artifactDirectory, "content-version.json"));
      expect(Object.keys(version)).toEqual(["schemaVersion", "contentHash", "commitSha", "generatedAt", "deployedAt", "target", "publicBuildInputDigest", "producer"]);
      expect(version.schemaVersion).toBe(2);
      expect(version.contentHash).toBe(contentHash);
      expect(version.commitSha).toBe(candidateSha);
      expect(version.target).toBe("local");
      expect(version.deployedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      await writeFile(path.join(artifactDirectory, "index.html"), "tampered", "utf8");
      await expect(verifyArtifactManifest(artifactDirectory, candidateSha)).rejects.toThrow(
        /integrity verification failed/
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
