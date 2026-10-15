import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  priorityTestDirectories,
  priorityTestTargets,
  requiredPriorityFiles
} from "./runValidationTier.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("priority validation tier", () => {
  it("selects the required trust-boundary contracts before running Vitest", () => {
    expect(priorityTestTargets).toContain("functions");
    expect(priorityTestTargets).toEqual(expect.arrayContaining([
      "scripts/permanentBranchRuleset.test.mjs",
      "scripts/contactTransport.integration.test.ts",
      "scripts/checkDependencyAudit.test.mjs",
      "scripts/security",
      "scripts/localAutomation.test.mjs",
      "scripts/runVerification.test.mjs",
      "scripts/updateContactTlds.test.mjs",
      "src/features/contact/components/ContactNotifications.test.tsx",
      "src/features/contact/components/useContactStepTransition.test.tsx",
      "src/components/navigation/smartLink.test.tsx",
      "src/features/contact/contactStyles.test.ts",
      "src/styles/typographyStyles.test.ts"
    ]));
    expect(requiredPriorityFiles).toEqual(expect.arrayContaining([
      "scripts/checkDependencyAudit.test.mjs",
      "scripts/candidateAdmissionWorkflow.test.mjs",
      "scripts/security/checkSarif.test.mjs",
      "scripts/security/ciGate.test.mjs",
      "scripts/security/deployWorkflow.test.mjs",
      "scripts/heartbeatWorkflow.test.mjs",
      "scripts/security/installPinnedTool.test.mjs",
      "scripts/security/securityScans.test.mjs",
      "src/components/portfolio/shared/DetailDisclosureList.test.tsx",
      "src/components/portfolio/shared/detailDisclosureStyles.test.ts",
      "src/features/projects/components/ProjectSkillShowcase.test.tsx",
      "src/features/projects/components/ProjectShowcase.test.tsx"
    ]));

    for (const directory of priorityTestDirectories) {
      expect(existsSync(path.join(projectRoot, directory))).toBe(true);
      expect(priorityTestTargets).toContain(directory);
    }

    for (const requiredFile of requiredPriorityFiles) {
      expect(existsSync(path.join(projectRoot, requiredFile))).toBe(true);
    }
  });
});
