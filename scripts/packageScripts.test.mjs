import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createArtifactManifest, verifyArtifactManifest } from "./artifactIntegrity.mjs";
import { resolvePagesDeploymentUrl } from "./checkDeployedContent.mjs";
import {
  priorityTestDirectories,
  priorityTestTargets,
  requiredPriorityFiles
} from "./runValidationTier.mjs";
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
    expect(packageJson.scripts["test:e2e:contact"]).toBe(
      "playwright test contact.spec.ts --project=chromium"
    );
    expect(packageJson.scripts["test:e2e:priority"]).toBe(
      "playwright test skeleton-alignment.spec.ts skeletons.transition.spec.ts navigation.spec.ts footer.spec.ts contact.spec.ts recommendations.spec.ts experience.spec.ts projects.spec.ts research.spec.ts research-mobile-video.spec.ts --project=chromium"
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
    expect(priorityTestDirectories).toEqual([
      "scripts/security",
      "src/components/overlay",
      "src/components/portfolio/experience",
      "src/features/projects",
      "src/components/portfolio/recommendations",
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
        "scripts/security/ciGate.test.mjs",
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
        "src/components/portfolio/experience/ExperienceShowcase.test.tsx",
        "src/features/projects/components/ProjectSkillShowcase.test.tsx",
        "src/features/projects/components/ProjectShowcase.test.tsx",
        "src/components/portfolio/recommendations/RecommendationsList.test.tsx",
        "src/features/research/components/ResearchShowcase.test.tsx",
        "src/components/overlay/ModalDialog.test.tsx"
      ])
    );

    expect(packageJson.scripts["test:e2e:full"]).toBe("playwright test --project=chromium");
  });

  it("routes every trigger through a checked candidate, independent scanners, and the stable verify gate", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toMatch(/push:\s+branches: \[main, develop\]/);
    expect(workflow).toMatch(/pull_request:\s+branches: \[main, develop\]/);
    expect(workflow).toContain('- cron: "17 13 * * *"');
    expect(workflow).toMatch(
      /workflow_dispatch:\s+inputs:\s+force_deploy:[\s\S]*?type: boolean\s+default: true/
    );
    for (const job of ["candidate-admission", "candidate-precheck", "application-validation", "security-tools", "security-scans", "codeql", "dependency-review", "verify"]) {
      expect(workflow).toContain(`  ${job}:`);
    }
    expect(workflow).toContain("needs: [candidate-admission, candidate-precheck, application-validation, security-tools, security-scans, codeql, dependency-review]");
    expect(workflow).toMatch(/verify:\s+name: verify\s+if: always\(\)/);
    for (const action of [
      "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0",
      "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0",
      "github/codeql-action/init@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2",
      "actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5.0.0"
    ]) expect(workflow).toContain(action);
    expect(workflow).toContain(
      "ref: ${{ needs.candidate-admission.outputs.candidate_sha }}"
    );
    const admission = section(workflow, "  candidate-admission:", "\n  candidate-precheck:");
    expect(admission).toContain('[[ "$REPOSITORY" == "nicolasgioanni/Smart-Porfolio" ]]');
    expect(admission).toContain('expected_workflow_ref="$REPOSITORY/.github/workflows/ci.yml@$EVENT_REF"');
    expect(admission).toContain('[[ "$WORKFLOW_REF" == "$expected_workflow_ref" ]]');
    expect(admission).toContain('[[ "$WORKFLOW_SHA" == "$EVENT_SHA" ]]');
    for (const variable of ["EVENT_NAME", "EVENT_REF", "EVENT_SHA", "EVENT_BASE_REF", "WORKFLOW_REF", "WORKFLOW_SHA", "REPOSITORY"]) {
      expect(admission).toContain(variable + ": ${{ github.");
    }
    const securityTools = section(workflow, "  security-tools:", "\n  security-scans:");
    expect(securityTools).toContain("-shellcheck ''");
    expect(securityTools).toContain("-pyflakes ''");
    expect(securityTools).not.toContain(".github/workflows/ci.yml");
    expect(securityTools).not.toContain(".github/workflows/skeleton-baselines.yml");
    expect(securityTools).not.toMatch(/\.github\/workflows\/[^\s]+\.ya?ml/);
    expect(workflow).toContain("pages_domain: ${{ needs.application-validation.outputs.pages_domain }}");
    expect(workflow).toContain("pages_project_name: ${{ needs.application-validation.outputs.pages_project_name }}");
    expect(workflow).not.toContain("pull_request_target:");
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).not.toMatch(/^\s+(?:deployment|deployment_status|workflow_run|repository_dispatch):/m);
    expect(workflow).not.toContain("--no-verify");
    expect(workflow).not.toMatch(/SKIP_(?:TESTS|BUILD|VERIFY|DEPLOY)/);
    expect(workflow.match(/persist-credentials: false/g).length).toBeGreaterThanOrEqual(7);
  });

  it("runs priority template verification for pull requests without deployment credentials", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const applicationJob = section(workflow, "  application-validation:", "\n  security-tools:");
    const pullRequestGeneration = section(
      applicationJob,
      "- name: Generate validated local template content for pull requests",
      "- name: Validate the immutable Cloudflare Pages target"
    );
    const pullRequestBuild = section(
      applicationJob,
      "- name: Build the pull-request snapshot without remote credentials",
      "- name: Build the exact production snapshot"
    );

    expect(applicationJob).toContain("Generate validated local template content for pull requests");
    expect(applicationJob).toContain("if: github.event_name == 'pull_request'");
    expect(applicationJob).toContain('PORTFOLIO_REQUIRE_REMOTE_CONTENT: "false"');
    expect(pullRequestGeneration).toContain('PORTFOLIO_WORKBOOK_URL: ""');
    expect(applicationJob).toContain("run: npm run lint");
    expect(applicationJob).not.toContain("run: npm run audit:check");
    const independentScans = section(workflow, "  security-scans:", "\n  codeql:");
    expect(independentScans).toContain("- name: Audit locked dependencies independently of application content\n        run: npm run audit:check");
    expect(independentScans).not.toContain("should_verify");
    expect(applicationJob).toContain("run: npm run typecheck");
    expect(applicationJob).toContain("run: npm run test:priority");
    expect(applicationJob).toContain("run: npx --no-install playwright install --with-deps chromium");
    expect(applicationJob).toContain("run: npm run test:e2e:priority");
    expect(applicationJob).toContain("run: npm run test:e2e:skeletons:visual");
    expect(applicationJob).not.toContain("run: npm run test:footer");
    expect(applicationJob).not.toContain("run: npm run test:navigation");
    expect(applicationJob).toMatch(
      /- name: Priority unit and contract tests\s+if: steps\.decision\.outputs\.verification_tier == 'priority'\s+run: npm run test:priority/
    );
    expect(applicationJob).toMatch(
      /- name: Priority browser regression suite\s+if: steps\.decision\.outputs\.verification_tier == 'priority'\s+run: npm run test:e2e:priority/
    );
    expect(applicationJob).toMatch(
      /- name: Linux skeleton visual regression\s+if: steps\.decision\.outputs\.verification_tier == 'priority'\s+run: npm run test:e2e:skeletons:visual/
    );
    expect(pullRequestBuild).toContain("run: npm run build:generated");
    expect(pullRequestGeneration).not.toContain("secrets.");
    expect(pullRequestBuild).not.toContain("NEXT_PUBLIC_TURNSTILE");
    expect(pullRequestBuild).not.toContain("secrets.");
    expect(applicationJob).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(applicationJob).not.toContain("CLOUDFLARE_ACCOUNT_ID");
  });

  it("generates one strict workbook snapshot for latest main and develop candidates", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const applicationJob = section(workflow, "  application-validation:", "\n  security-tools:");
    const workbookStep = section(
      applicationJob,
      "- name: Fetch and generate the strict public workbook snapshot",
      "- name: Read the validated workbook content hash"
    );

    expect(applicationJob).toContain("Fetch and generate the strict public workbook snapshot");
    expect(workbookStep).toContain(
      "if: github.event_name != 'pull_request' && needs.candidate-precheck.outputs.is_latest == 'true'"
    );
    expect(workbookStep).toContain(
      "PORTFOLIO_WORKBOOK_URL: ${{ secrets.PORTFOLIO_WORKBOOK_URL }}"
    );
    expect(applicationJob).not.toContain("PORTFOLIO_WORKBOOK_URL: ${{ vars.PORTFOLIO_WORKBOOK_URL }}");
    expect(applicationJob).toContain('PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true"');
    expect(applicationJob).not.toContain("PORTFOLIO_GOOGLE_SHEET_URL");
    expect(applicationJob).not.toMatch(/PORTFOLIO_[A-Z_]+_CSV_URL/);
    expect(applicationJob).toContain("Validate the immutable Cloudflare Pages target");
    expect(applicationJob).toContain(
      '[[ "$CLOUDFLARE_PAGES_PROJECT_NAME" != "smart-portfolio" ]]'
    );
    expect(applicationJob).toContain(
      '[[ "$CLOUDFLARE_PAGES_DOMAIN" != "smart-portfolio-bds.pages.dev" ]]'
    );
    expect(applicationJob.indexOf("Validate the immutable Cloudflare Pages target")).toBeLessThan(
      applicationJob.indexOf("Fetch and generate the strict public workbook snapshot")
    );
    expect(applicationJob).not.toContain("Mask the anonymous workbook URL");
    expect(applicationJob).not.toContain("::add-mask::");
    expect(applicationJob.indexOf("run: npm run generate:content")).toBeLessThan(
      applicationJob.indexOf("run: npm run lint")
    );
    expect(workflow).toContain("git fetch --no-tags origin");
    expect(applicationJob).toContain("Generated content is missing a valid SHA-256 contentHash");
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

  it("polls deployed no-cache metadata and skips expensive work only for the exact candidate", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const applicationJob = section(workflow, "  application-validation:", "\n  security-tools:");
    const comparisonStep = section(
      applicationJob,
      "- name: Compare the validated snapshot with production",
      "- name: Decide verification tier and deployment"
    );

    expect(applicationJob).toContain("Compare the validated snapshot with production");
    expect(applicationJob).toContain("node scripts/checkDeployedContent.mjs compare");
    expect(applicationJob).toContain("CLOUDFLARE_PAGES_DOMAIN: ${{ steps.pages.outputs.pages_domain }}");
    expect(applicationJob).toContain(
      'node scripts/checkDeployedContent.mjs url "$CLOUDFLARE_PAGES_DOMAIN" main'
    );
    expect(applicationJob).toContain(
      "(github.event_name == 'workflow_dispatch' && inputs.force_deploy == false)"
    );
    expect(applicationJob).not.toContain("https://${CLOUDFLARE_PAGES_PROJECT_NAME}.pages.dev");
    expect(applicationJob).toContain('"${FORCE_DEPLOY:-false}" == "true"');
    expect(applicationJob).toContain('"${DEPLOYED_CONTENT_MATCHES:-false}" != "true"');
    expect(applicationJob).toContain('"${DEPLOYED_COMMIT_MATCHES:-false}" != "true"');
    expect(applicationJob).toContain(
      "DEPLOYED_COMMIT_MATCHES: ${{ steps.deployed_content.outputs.deployed_commit_matches }}"
    );
    expect(comparisonStep).toContain('"$CONTENT_HASH" \\');
    expect(comparisonStep).toContain('"$CANDIDATE_SHA" \\');

    for (const stepName of ["Documentation integrity", "Lint", "Typecheck", "Install Chromium for browser regressions"]) {
      expect(applicationJob).toMatch(
        new RegExp(`- name: ${stepName}\\s+if: steps\\.decision\\.outputs\\.should_verify == 'true'`)
      );
    }
    for (const [stepName, tier] of [
      ["Priority unit and contract tests", "priority"],
      ["Priority browser regression suite", "priority"],
      ["Linux skeleton visual regression", "priority"],
      ["Full unit and integration suite", "full"],
      ["Full browser regression suite", "full"]
    ]) {
      expect(applicationJob).toMatch(
        new RegExp(`- name: ${stepName}\\s+if: steps\\.decision\\.outputs\\.verification_tier == '${tier}'`)
      );
    }
    expect(applicationJob).toContain('verification_tier="priority"');
    expect(applicationJob).toContain('verification_tier="full"');
    expect(applicationJob).toContain('echo "verification_tier=$verification_tier" >> "$GITHUB_OUTPUT"');
    expect(applicationJob).toMatch(
      /- name: Upload the exact verified static export\s+if: steps\.decision\.outputs\.should_deploy == 'true'/
    );

    expect(applicationJob).toContain("runs-on: ubuntu-24.04");
    expect(applicationJob.match(/playwright install --with-deps chromium/g)).toHaveLength(1);
    expect(applicationJob.indexOf("Install Chromium for browser regressions")).toBeLessThan(
      applicationJob.indexOf("Priority browser regression suite")
    );
    expect(applicationJob.indexOf("Priority browser regression suite")).toBeLessThan(
      applicationJob.indexOf("Linux skeleton visual regression")
    );
    expect(applicationJob.indexOf("Linux skeleton visual regression")).toBeLessThan(
      applicationJob.indexOf("Full browser regression suite")
    );
    expect(applicationJob.match(/run: npm run test:e2e:full/g)).toHaveLength(1);
    expect(applicationJob).toMatch(
      /- name: Full browser regression suite\s+if: steps\.decision\.outputs\.verification_tier == 'full'\s+run: npm run test:e2e:full/
    );

    const diagnosticsUpload = section(
      applicationJob,
      "- name: Upload Playwright diagnostics on failure",
      "- name: Build the pull-request snapshot without remote credentials"
    );
    expect(diagnosticsUpload).toContain("if: failure()");
    expect(diagnosticsUpload).toContain(
      "uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1"
    );
    expect(diagnosticsUpload).toContain(
      "name: playwright-diagnostics-${{ github.run_id }}-${{ github.run_attempt }}"
    );
    expect(diagnosticsUpload).toMatch(/path: \|\s+playwright-report\/\s+test-results\//);
    expect(diagnosticsUpload).toContain("if-no-files-found: ignore");
    expect(diagnosticsUpload).not.toContain("cloudflare-pages-build");
    expect(diagnosticsUpload).not.toContain("path: out/");
    expect(diagnosticsUpload).not.toContain("should_deploy");
    expect(applicationJob.indexOf("Upload Playwright diagnostics on failure")).toBeLessThan(
      applicationJob.indexOf("Build the pull-request snapshot without remote credentials")
    );
    expect(applicationJob.match(/name: cloudflare-pages-build/g)).toHaveLength(1);
  });

  it("deploys only the immutable green artifact with pinned local Wrangler", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const applicationJob = section(workflow, "  application-validation:", "\n  security-tools:");
    const verifyJob = section(workflow, "  verify:", "\n  deploy:");
    const deployJob = section(workflow, "  deploy:", "\n  heartbeat:");

    expect(applicationJob).toContain("node scripts/artifactIntegrity.mjs create out");
    expect(applicationJob).toContain("node scripts/artifactIntegrity.mjs verify out");
    expect(applicationJob).toContain("name: cloudflare-pages-build");
    expect(applicationJob).toMatch(/path: out\/\s+include-hidden-files: true\s+if-no-files-found: error/);
    expect(verifyJob).toContain("needs: [candidate-admission, candidate-precheck, application-validation, security-tools, security-scans, codeql, dependency-review]");
    expect(verifyJob).toContain("CI_GATE_RESULTS: ${{ toJSON(needs) }}");
    expect(verifyJob).toContain("node scripts/security/ciGate.mjs");
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
    expect(applicationJob).toContain(
      '[[ "$GITHUB_EVENT_NAME" == "push" && "$GITHUB_REF" == "refs/heads/main" ]]'
    );
    expect(applicationJob).toContain('deploy_target="production"');
    expect(applicationJob).toContain(
      '[[ "$GITHUB_EVENT_NAME" == "push" && "$GITHUB_REF" == "refs/heads/develop" ]]'
    );
    expect(applicationJob).toContain('deploy_target="preview"');
    expect(workflow).toContain('candidate_branch="$GITHUB_REF_NAME"');
    expect(deployJob).toContain("node scripts/checkDeployedContent.mjs smoke");
    expect(deployJob).toContain(
      'node scripts/checkDeployedContent.mjs url "$CLOUDFLARE_PAGES_DOMAIN" "$CANDIDATE_BRANCH"'
    );
    expect(deployJob).not.toContain(".${CLOUDFLARE_PAGES_PROJECT_NAME}.pages.dev");
    expect(deployJob.indexOf("Recheck the deployment branch immediately before Wrangler")).toBeLessThan(
      deployJob.indexOf("npx --no-install wrangler pages deploy out")
    );
  });

  it("allows repository writes only for the guarded existing develop heartbeat", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const deployJob = section(workflow, "  deploy:", "\n  heartbeat:");
    const heartbeatJob = section(workflow, "  heartbeat:");

    expect(workflow.match(/contents: write/g)).toHaveLength(1);
    expect(workflow.match(/security-events: write/g)).toHaveLength(1);
    expect(section(workflow, "  codeql:", "\n  dependency-review:")).toMatch(
      /permissions:\s+contents: read\s+security-events: write/
    );
    expect(workflow.match(/pull-requests: read/g)).toHaveLength(1);
    expect(deployJob).toMatch(/permissions:\s+contents: read/);
    expect(heartbeatJob).toContain("if: github.event_name == 'schedule'");
    expect(heartbeatJob).toMatch(
      /concurrency:\s+group: develop-schedule-heartbeat\s+cancel-in-progress: false/
    );
    expect(heartbeatJob).toContain("ref: develop");
    expect(heartbeatJob).toContain("refs/remotes/origin/main");
    expect(heartbeatJob).toContain("refs/remotes/origin/develop");
    expect(heartbeatJob).toContain("origin/develop must already exist");
    expect(heartbeatJob).toContain("30 * 24 * 60 * 60");
    expect(heartbeatJob).toContain('heartbeat_path=".github/schedule-heartbeat"');
    expect(heartbeatJob).toContain("git merge --ff-only refs/remotes/origin/develop");
    expect(heartbeatJob).toContain("git switch --track --create develop refs/remotes/origin/develop");
    expect(heartbeatJob).toContain('git merge-base --is-ancestor "$develop_sha" HEAD');
    expect(heartbeatJob).toContain('remote_develop_sha="$(git ls-remote origin refs/heads/develop | awk \'{print $1}\')"');
    expect(heartbeatJob).toContain("GH_TOKEN: ${{ github.token }}");
    expect(heartbeatJob).toContain("GIT_ASKPASS=\"$askpass_path\"");
    expect(heartbeatJob).toContain("git -c credential.helper= push origin \"HEAD:refs/heads/develop\"");
    expect(heartbeatJob).not.toContain("automation-heartbeat");
    expect(heartbeatJob).not.toContain("git push --force");
    const developRefCheck = heartbeatJob.indexOf(
      "git ls-remote --exit-code --heads origin develop"
    );
    const developBaseline = heartbeatJob.indexOf(
      'develop_sha="$(git rev-parse refs/remotes/origin/develop)"'
    );
    const fastForwardCheck = heartbeatJob.indexOf(
      'git merge-base --is-ancestor "$develop_sha" HEAD'
    );
    const remoteShaReread = heartbeatJob.indexOf(
      'remote_develop_sha="$(git ls-remote origin refs/heads/develop | awk \'{print $1}\')"'
    );
    const nonForcePush = heartbeatJob.indexOf("git -c credential.helper= push origin \"HEAD:refs/heads/develop\"");

    expect(nonForcePush).toBeGreaterThan(-1);
    for (const guard of [developRefCheck, developBaseline, fastForwardCheck, remoteShaReread]) {
      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(nonForcePush);
    }
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
