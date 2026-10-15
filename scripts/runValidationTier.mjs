import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const vitestEntryPoint = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");

export const priorityTestDirectories = [
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
];

export const priorityTestTargets = [
  "scripts/validateDocumentation.test.mjs",
  "scripts/permanentBranchRuleset.test.mjs",
  "scripts/contactTransport.integration.test.ts",
  "scripts/updateContactTlds.test.mjs",
  "scripts/packageScripts.test.mjs",
  "scripts/localAutomation.test.mjs",
  "scripts/runVerification.test.mjs",
  "scripts/runValidationTier.test.mjs",
  "scripts/checkDeployedContent.test.mjs",
  "scripts/checkDependencyAudit.test.mjs",
  "scripts/release/runtimeConfig.test.mjs",
  "scripts/candidateAdmissionWorkflow.test.mjs",
  "scripts/heartbeatWorkflow.test.mjs",
  "scripts/renderRouteSkeleton.test.mjs",
  "scripts/d1Configuration.test.mjs",
  "scripts/portfolioContentGeneration.test.ts",
  "scripts/pngMetadata.test.mjs",
  "functions",
  "src/app/contact/contact.test.tsx",
  "src/features/contact/components/useContactStepTransition.test.tsx",
  "src/features/contact/components/contactFormValidation.test.ts",
  "src/features/contact/components/TurnstileWidget.test.tsx",
  "src/features/contact/components/ContactNotifications.test.tsx",
  "src/features/contact/contactStyles.test.ts",
  "src/components/loading/skeletonContentContract.test.ts",
  "src/components/layout/ResearchNoScriptRouteGate.test.tsx",
  "src/components/layout/RouteNoScriptFallback.test.tsx",
  "src/components/layout/SiteShell.test.tsx",
  "src/components/motion",
  "src/features/home/components/HomeEducationDetails.test.tsx",
  "src/components/navigation/MobileNavigation.test.tsx",
  "src/components/navigation/navigation.test.tsx",
  "src/components/navigation/smartLink.test.tsx",
  ...priorityTestDirectories,
  "src/lib/architecture/importBoundaries.test.ts",
  "src/lib/content/content.test.ts",
  "src/lib/content/security.test.ts",
  "src/lib/media/researchVideoAssets.test.ts",
  "src/lib/media/researchVideoPlayback.test.ts",
  "src/lib/routing/siteRoutes.test.ts",
  "src/styles/typographyStyles.test.ts",
  "src/styles/themePalette.test.ts"
];

export const requiredPriorityFiles = [...new Set([
  ...priorityTestTargets.filter((target) => /\.test\.(?:[cm]?[jt]sx?)$/.test(target)),
  "scripts/ci/plan.test.mjs",
  "scripts/ci/infrastructure.test.mjs",
  "scripts/ci/resolve.test.mjs",
  "scripts/ci/snapshot.test.mjs",
  "scripts/ci/receipts.test.mjs",
  "scripts/ci/workflowGraph.test.mjs",
  "scripts/ci/browserDiscovery.test.mjs",
  "scripts/ci/githubEvidence.test.mjs",
  "scripts/ci/effectiveExecution.test.mjs",
  "scripts/ci/validationEvidence.test.mjs",
  "scripts/ci/artifactTransport.test.mjs",
  "scripts/ci/workflowYaml.test.mjs",
  "scripts/ci/runner.test.mjs",
  "scripts/ci/deployedIdentity.test.mjs",
  "scripts/security/verifyAttestation.test.mjs",
  "functions/api/contact.test.ts",
  "functions/api/contact/verify.test.ts",
  "scripts/checkDependencyAudit.test.mjs",
  "scripts/candidateAdmissionWorkflow.test.mjs",
  "scripts/security/checkSarif.test.mjs",
  "scripts/ci/gate.test.mjs",
  "scripts/heartbeatWorkflow.test.mjs",
  "scripts/security/installPinnedTool.test.mjs",
  "scripts/security/securityScans.test.mjs",
  "src/components/overlay/ModalDialog.test.tsx",
  "src/components/portfolio/shared/DetailDisclosureList.test.tsx",
  "src/components/portfolio/shared/detailDisclosureStyles.test.ts",
  "src/features/experience/components/ExperienceShowcase.test.tsx",
  "src/features/experience/components/experienceStyles.test.ts",
  "src/features/projects/components/ProjectSkillShowcase.test.tsx",
  "src/features/projects/components/ProjectShowcase.test.tsx",
  "src/features/recommendations/components/ExpandableRecommendationText.test.tsx",
  "src/features/recommendations/components/RecommendationVerificationLink.test.tsx",
  "src/features/recommendations/components/RecommendationsList.test.tsx",
  "src/features/recommendations/components/recommendationLayout.test.ts",
  "src/features/recommendations/components/recommendationStyles.test.ts",
  "src/features/research/components/ResearchGraphicalAbstractPreview.test.tsx",
  "src/features/research/components/ResearchShowcase.test.tsx",
  "src/features/research/components/ResearchVideoPreview.test.tsx",
  "src/features/research/components/researchStyles.test.ts",
  "src/features/research/content/researchGraphicalAbstracts.test.ts",
  "src/features/research/content/researchVideos.test.ts",
  "src/features/research/loading/ResearchPageSkeleton.test.tsx",
  "src/components/theme/ThemePreferenceScript.test.tsx",
  "src/components/theme/ThemeSwitcher.test.tsx",
  "src/lib/theme/resolveThemeName.test.ts",
  "src/lib/theme/themeOptions.test.ts",
  "src/lib/theme/themePreference.test.ts",
  "src/lib/theme/themeTransition.test.ts"
])];

function runVitest(command, targets, captureOutput = false) {
  return spawnSync(process.execPath, [vitestEntryPoint, command, ...targets], {
    cwd: projectRoot,
    encoding: captureOutput ? "utf8" : undefined,
    stdio: captureOutput ? "pipe" : "inherit"
  });
}

function assertPriorityDiscovery() {
  const result = runVitest("list", ["--filesOnly", ...priorityTestTargets], true);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "Vitest could not list priority tests.\n");
    process.exit(result.status ?? 1);
  }

  const listedTests = (result.stdout ?? "").replaceAll("\\", "/");
  const missing = requiredPriorityFiles.filter((file) => !listedTests.includes(file));
  if (missing.length > 0) {
    throw new Error(`Priority test discovery omitted required coverage:\n${missing.join("\n")}`);
  }
}

function runPriorityTier() {
  if (!existsSync(vitestEntryPoint)) {
    throw new Error("Vitest is not installed. Run npm ci before selecting a validation tier.");
  }

  assertPriorityDiscovery();
  const result = runVitest("run", priorityTestTargets);
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "priority") {
    throw new Error("Usage: node scripts/runValidationTier.mjs priority");
  }
  runPriorityTier();
}
