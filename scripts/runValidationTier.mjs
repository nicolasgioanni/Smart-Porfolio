import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const vitestEntryPoint = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");

export const priorityTestTargets = [
  "scripts/validateDocumentation.test.mjs",
  "scripts/contactTransport.integration.test.ts",
  "scripts/updateContactTlds.test.mjs",
  "scripts/packageScripts.test.mjs",
  "scripts/runValidationTier.test.mjs",
  "scripts/checkDeployedContent.test.mjs",
  "scripts/renderRouteSkeleton.test.mjs",
  "scripts/d1Configuration.test.mjs",
  "scripts/portfolioContentGeneration.test.ts",
  "scripts/pngMetadata.test.mjs",
  "functions",
  "src/app/contact/contact.test.tsx",
  "src/components/contact/contactFormValidation.test.ts",
  "src/components/contact/TurnstileWidget.test.tsx",
  "src/components/contact/ContactNotifications.test.tsx",
  "src/styles/contactStyles.test.ts",
  "src/components/loading/skeletonContentContract.test.ts",
  "src/components/navigation/MobileNavigation.test.tsx",
  "src/components/navigation/navigation.test.tsx",
  "src/components/overlay/ModalDialog.test.tsx",
  "src/components/portfolio/research/ResearchGraphicalAbstractPreview.test.tsx",
  "src/components/portfolio/research/ResearchVideoPreview.test.tsx",
  "src/components/theme/ThemePreferenceScript.test.tsx",
  "src/components/theme/ThemeSwitcher.test.tsx",
  "src/lib/architecture/importBoundaries.test.ts",
  "src/lib/content/content.test.ts",
  "src/lib/content/researchGraphicalAbstracts.test.ts",
  "src/lib/content/researchVideos.test.ts",
  "src/lib/content/security.test.ts",
  "src/lib/media/researchVideoAssets.test.ts",
  "src/lib/media/researchVideoPlayback.test.ts",
  "src/lib/routing/siteRoutes.test.ts",
  "src/lib/theme/resolveThemeName.test.ts",
  "src/lib/theme/themeOptions.test.ts",
  "src/lib/theme/themePreference.test.ts",
  "src/lib/theme/themeTransition.test.ts"
];

export const requiredPriorityFiles = [...new Set([
  ...priorityTestTargets.filter((target) => /\.test\.(?:[cm]?[jt]sx?)$/.test(target)),
  "functions/api/contact.test.ts",
  "functions/api/contact/verify.test.ts"
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
