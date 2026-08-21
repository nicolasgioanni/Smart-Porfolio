import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createArtifactManifest, verifyArtifactManifest } from "./artifactIntegrity.mjs";
import { resolvePagesDeploymentUrl } from "./checkDeployedContent.mjs";
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
    const nvmVersion = (await readFile(path.join(projectRoot, ".nvmrc"), "utf8")).trim();

    expect(packageJson.engines.node).toBe(">=22.13.0");
    expect(nvmVersion).toBe("22");
    expect(packageJson.scripts.build).toBe("next build && node scripts/writeContentVersion.mjs");
    expect(packageJson.scripts["build:generated"]).toBe(
      "next build && node scripts/writeContentVersion.mjs"
    );
    expect(packageJson.scripts["dev:pages"]).toContain("npx --no-install wrangler");
    expect(packageJson.devDependencies.wrangler).toBe("4.127.0");
    expect(packageJson.devDependencies.vitest).toBe("4.1.11");
    expect(packageJson.scripts["test:footer"]).toBe(
      "vitest run src/components/layout/InteractiveBlobFooter.test.tsx src/components/layout/footerStyles.test.ts"
    );
  });

  it("keeps a stable verify job across branch, daily, and forced-manual triggers", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toMatch(/push:\s+branches: \[main, develop\]/);
    expect(workflow).toMatch(/pull_request:\s+branches: \[main, develop\]/);
    expect(workflow).toContain('- cron: "17 13 * * *"');
    expect(workflow).toMatch(
      /workflow_dispatch:\s+inputs:\s+force_deploy:[\s\S]*?type: boolean\s+default: true/
    );
    expect(workflow).toMatch(/jobs:\s+verify:\s+name: verify/);
    expect(workflow.match(/node-version: 22/g)).toHaveLength(3);
    expect(workflow).toContain(
      "ref: ${{ (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') && 'main' || github.sha }}"
    );
    expect(workflow).toContain("pages_domain: ${{ steps.pages.outputs.pages_domain }}");
    expect(workflow).toContain("pages_project_name: ${{ steps.pages.outputs.pages_project_name }}");
    expect(workflow).not.toContain("pull_request_target:");
    expect(workflow).not.toContain("always()");
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).not.toMatch(/^\s+(?:deployment|deployment_status|workflow_run|repository_dispatch):/m);
    expect(workflow).not.toContain("--no-verify");
    expect(workflow).not.toMatch(/SKIP_(?:TESTS|BUILD|VERIFY|DEPLOY)/);
  });

  it("runs full template verification for pull requests without deployment credentials", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const verifyJob = section(workflow, "  verify:", "\n  deploy:");
    const pullRequestGeneration = section(
      verifyJob,
      "- name: Generate validated local template content for pull requests",
      "- name: Validate the immutable Cloudflare Pages target"
    );
    const pullRequestBuild = section(
      verifyJob,
      "- name: Build the pull-request snapshot without remote credentials",
      "- name: Build the exact production snapshot"
    );

    expect(verifyJob).toContain("Generate validated local template content for pull requests");
    expect(verifyJob).toContain("if: github.event_name == 'pull_request'");
    expect(verifyJob).toContain('PORTFOLIO_REQUIRE_REMOTE_CONTENT: "false"');
    expect(verifyJob).toContain("run: npm run lint");
    expect(verifyJob).toContain("run: npm run typecheck");
    expect(verifyJob).toContain("run: npm run test:footer");
    expect(verifyJob).toContain("run: npm run test");
    expect(pullRequestBuild).toContain("run: npm run build:generated");
    expect(pullRequestGeneration).not.toContain("secrets.");
    expect(pullRequestBuild).not.toContain("NEXT_PUBLIC_TURNSTILE");
    expect(pullRequestBuild).not.toContain("secrets.");
    expect(verifyJob).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(verifyJob).not.toContain("CLOUDFLARE_ACCOUNT_ID");
  });

  it("fetches one strict workbook snapshot for latest main and develop candidates", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const verifyJob = section(workflow, "  verify:", "\n  deploy:");
    const workbookStep = section(
      verifyJob,
      "- name: Fetch and generate the strict public workbook snapshot once",
      "- name: Read the validated workbook content hash"
    );

    expect(verifyJob).toContain("Fetch and generate the strict public workbook snapshot once");
    expect(workbookStep).toContain(
      "if: github.event_name != 'pull_request' && steps.candidate.outputs.is_latest == 'true'"
    );
    expect(workbookStep).toContain(
      "PORTFOLIO_WORKBOOK_URL: ${{ secrets.PORTFOLIO_WORKBOOK_URL }}"
    );
    expect(verifyJob).not.toContain("PORTFOLIO_WORKBOOK_URL: ${{ vars.PORTFOLIO_WORKBOOK_URL }}");
    expect(verifyJob).toContain('PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true"');
    expect(verifyJob).not.toContain("PORTFOLIO_GOOGLE_SHEET_URL");
    expect(verifyJob).not.toMatch(/PORTFOLIO_[A-Z_]+_CSV_URL/);
    expect(verifyJob).toContain("Validate the immutable Cloudflare Pages target");
    expect(verifyJob).toContain(
      '[[ "$CLOUDFLARE_PAGES_PROJECT_NAME" != "smart-portfolio" ]]'
    );
    expect(verifyJob).toContain(
      '[[ "$CLOUDFLARE_PAGES_DOMAIN" != "smart-portfolio-bds.pages.dev" ]]'
    );
    expect(verifyJob.indexOf("Validate the immutable Cloudflare Pages target")).toBeLessThan(
      verifyJob.indexOf("Fetch and generate the strict public workbook snapshot once")
    );
    expect(verifyJob).not.toContain("Mask the anonymous workbook URL");
    expect(verifyJob).not.toContain("::add-mask::");
    expect(verifyJob.indexOf("run: npm run generate:content")).toBeLessThan(
      verifyJob.indexOf("run: npm run lint")
    );
    expect(verifyJob).toContain("git fetch --no-tags origin");
    expect(verifyJob).toContain("Generated content is missing a valid SHA-256 contentHash");
  });

  it("keeps production and optional preview Turnstile build keys isolated", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const productionBuild = section(
      workflow,
      "- name: Build the exact production snapshot",
      "- name: Build the exact develop preview snapshot"
    );
    const previewBuild = section(
      workflow,
      "- name: Build the exact develop preview snapshot",
      "- name: Create and verify the artifact integrity manifest"
    );

    expect(productionBuild).toContain(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${{ vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}"
    );
    expect(productionBuild).not.toContain("NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY");
    expect(previewBuild).toContain(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${{ vars.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY }}"
    );
    expect(previewBuild).not.toContain("vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}");
  });

  it("polls deployed no-cache metadata and skips all expensive work when unchanged", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const verifyJob = section(workflow, "  verify:", "\n  deploy:");

    expect(verifyJob).toContain("Compare the validated snapshot with production");
    expect(verifyJob).toContain("node scripts/checkDeployedContent.mjs compare");
    expect(verifyJob).toContain("CLOUDFLARE_PAGES_DOMAIN: ${{ steps.pages.outputs.pages_domain }}");
    expect(verifyJob).toContain(
      'node scripts/checkDeployedContent.mjs url "$CLOUDFLARE_PAGES_DOMAIN" main'
    );
    expect(verifyJob).toContain(
      "(github.event_name == 'workflow_dispatch' && inputs.force_deploy == false)"
    );
    expect(verifyJob).not.toContain("https://${CLOUDFLARE_PAGES_PROJECT_NAME}.pages.dev");
    expect(verifyJob).toContain('"${FORCE_DEPLOY:-false}" == "true"');
    expect(verifyJob).toContain('"${DEPLOYED_CONTENT_MATCHES:-false}" != "true"');

    for (const stepName of ["Lint", "Typecheck", "Footer regression tests", "Full test suite"]) {
      expect(verifyJob).toMatch(
        new RegExp(`- name: ${stepName}\\s+if: steps\\.decision\\.outputs\\.should_verify == 'true'`)
      );
    }
    expect(verifyJob).toMatch(
      /- name: Upload the exact verified static export\s+if: steps\.decision\.outputs\.should_deploy == 'true'/
    );
  });

  it("deploys only the immutable green artifact with pinned local Wrangler", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const verifyJob = section(workflow, "  verify:", "\n  deploy:");
    const deployJob = section(workflow, "  deploy:", "\n  heartbeat:");

    expect(verifyJob).toContain("node scripts/artifactIntegrity.mjs create out");
    expect(verifyJob).toContain("node scripts/artifactIntegrity.mjs verify out");
    expect(verifyJob).toContain("name: cloudflare-pages-build");
    expect(verifyJob).toMatch(/path: out\/\s+include-hidden-files: true\s+if-no-files-found: error/);
    expect(deployJob).toContain("needs: verify");
    expect(deployJob).toContain(
      "if: needs.verify.result == 'success' && needs.verify.outputs.should_deploy == 'true'"
    );
    expect(deployJob).toContain("ref: ${{ needs.verify.outputs.candidate_sha }}");
    expect(deployJob).toContain('run: node scripts/artifactIntegrity.mjs verify out "$CANDIDATE_SHA"');
    expect(deployJob).not.toContain("npm run build");
    expect(deployJob).not.toContain("npm run generate:content");
    expect(deployJob).toContain("group: cloudflare-${{ needs.verify.outputs.deploy_target }}");
    expect(deployJob).toContain("cancel-in-progress: true");
    expect(deployJob).toContain("Recheck the deployment branch immediately before Wrangler");
    expect(deployJob).toContain(
      "CLOUDFLARE_PAGES_PROJECT_NAME: ${{ needs.verify.outputs.pages_project_name }}"
    );
    expect(deployJob).toContain(
      "CLOUDFLARE_PAGES_DOMAIN: ${{ needs.verify.outputs.pages_domain }}"
    );
    expect(deployJob).not.toContain("vars.CLOUDFLARE_PAGES_PROJECT_NAME");
    expect(deployJob).not.toContain("vars.CLOUDFLARE_PAGES_DOMAIN");
    expect(deployJob).toContain("npx --no-install wrangler pages deploy out");
    expect(deployJob).not.toContain("npx --yes");
    expect(deployJob).toContain('--branch "$CANDIDATE_BRANCH"');
    expect(verifyJob).toContain(
      '[[ "$GITHUB_EVENT_NAME" == "push" && "$GITHUB_REF" == "refs/heads/main" ]]'
    );
    expect(verifyJob).toContain('deploy_target="production"');
    expect(verifyJob).toContain(
      '[[ "$GITHUB_EVENT_NAME" == "push" && "$GITHUB_REF" == "refs/heads/develop" ]]'
    );
    expect(verifyJob).toContain('deploy_target="preview"');
    expect(verifyJob).toContain('candidate_branch="$GITHUB_REF_NAME"');
    expect(deployJob).toContain("node scripts/checkDeployedContent.mjs smoke");
    expect(deployJob).toContain(
      'node scripts/checkDeployedContent.mjs url "$CLOUDFLARE_PAGES_DOMAIN" "$CANDIDATE_BRANCH"'
    );
    expect(deployJob).not.toContain(".${CLOUDFLARE_PAGES_PROJECT_NAME}.pages.dev");
    expect(deployJob.indexOf("Recheck the deployment branch immediately before Wrangler")).toBeLessThan(
      deployJob.indexOf("npx --no-install wrangler pages deploy out")
    );
  });

  it("allows repository writes only for the isolated heartbeat branch", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const deployJob = section(workflow, "  deploy:", "\n  heartbeat:");
    const heartbeatJob = section(workflow, "  heartbeat:");

    expect(workflow.match(/contents: write/g)).toHaveLength(1);
    expect(workflow).not.toMatch(
      /(?:actions|checks|deployments|id-token|issues|packages|pull-requests|security-events|statuses): write/
    );
    expect(deployJob).toMatch(/permissions:\s+contents: read/);
    expect(heartbeatJob).toContain("if: github.event_name == 'schedule'");
    expect(heartbeatJob).toContain('heartbeat_branch="automation-heartbeat"');
    expect(heartbeatJob).toContain("refs/remotes/origin/main");
    expect(heartbeatJob).toContain("refs/remotes/origin/$heartbeat_branch");
    expect(heartbeatJob).toContain("30 * 24 * 60 * 60");
    expect(heartbeatJob).toContain('heartbeat_path=".github/schedule-heartbeat"');
    expect(heartbeatJob).toContain('git push origin "HEAD:refs/heads/$heartbeat_branch"');
    expect(workflow).not.toContain("git push origin HEAD:main");
    expect(workflow).not.toContain("git add -- \"$snapshot\"");
    expect(workflow).not.toContain("sync published Google Sheet");
    expect(workflow).not.toContain("[skip ci]");
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

    for (const secretName of ["TURNSTILE_SECRET_KEY", "RESEND_API_KEY", "CONTACT_RECIPIENT_EMAIL"]) {
      expect(serializedConfig).not.toContain(secretName);
    }
    expect(wranglerConfig.vars.TURNSTILE_ALLOWED_HOSTNAMES).toBe(
      "smart-portfolio-bds.pages.dev,nicolasmgioanni.dev,www.nicolasmgioanni.dev"
    );
    expect(wranglerConfig.vars.CONTACT_ALLOWED_ORIGINS).toBe(
      "https://smart-portfolio-bds.pages.dev,https://nicolasmgioanni.dev,https://www.nicolasmgioanni.dev"
    );
    expect(wranglerConfig.env.preview.vars.TURNSTILE_ALLOWED_HOSTNAMES).toBe(
      "develop.smart-portfolio-bds.pages.dev"
    );
    expect(wranglerConfig.env.preview.vars.CONTACT_ALLOWED_ORIGINS).toBe(
      "https://develop.smart-portfolio-bds.pages.dev"
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
        environment: { DEPLOYMENT_COMMIT_SHA: candidateSha }
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
      expect(Object.keys(version)).toEqual(["schemaVersion", "contentHash", "commitSha", "generatedAt", "deployedAt"]);
      expect(version.contentHash).toBe(contentHash);
      expect(version.commitSha).toBe(candidateSha);
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
