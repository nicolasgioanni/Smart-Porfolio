// This policy consumes a complete, trusted list of both sides of each rename.
// It does not inspect Git or execute path names. Unknown inputs select the full gate.
const ALL_VALIDATORS = ["quality", "unit", "chromium-1", "chromium-2", "visual", "cross-browser", "build-export", "security", "infrastructure"].sort();
const FEATURE_SPECS = {
  home: ["accessibility.spec.ts"],
  projects: ["projects.spec.ts"],
  research: ["research.spec.ts", "research-mobile-video.spec.ts"],
  experience: ["experience.spec.ts"],
  recommendations: ["recommendations.spec.ts"],
  skills: ["accessibility.spec.ts"],
  resume: ["accessibility.spec.ts"],
  legal: ["accessibility.spec.ts"],
};
const COMMON_SPECS = ["accessibility.spec.ts", "navigation.spec.ts", "progressiveEnhancement.spec.ts", "skeleton-alignment.spec.ts", "skeletons.transition.spec.ts"];
const TARGETED_VALIDATORS = ["quality", "unit", "chromium-1", "chromium-2", "visual", "build-export", "security"].sort();
const shaPattern = /^[a-f0-9]{40}$/;

function normalizePath(path) {
  if (typeof path !== "string" || !path || path.length > 4096 || path.startsWith("/") || path.includes("\\") || [...path].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new TypeError("Invalid changed path");
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) throw new TypeError("Invalid changed path");
  return path;
}

/** Create a fail-closed, provider-neutral plan from a complete Git diff.
 * Renames must supply both old and new paths; deletions supply the deleted path.
 */
export function createImpactPlan({ changedPaths, baseSha, headSha, forceFull = false, trigger = "pull_request" }) {
  if (!shaPattern.test(baseSha) || !shaPattern.test(headSha)) throw new TypeError("Invalid commit SHA");
  if (!Array.isArray(changedPaths) || changedPaths.length > 10000 || typeof forceFull !== "boolean" || typeof trigger !== "string") throw new TypeError("Invalid impact input");
  const paths = [...new Set(changedPaths.map(normalizePath))].sort();
  const features = new Set();
  const reasons = new Set();
  let full = forceFull || trigger !== "pull_request" || paths.length === 0;
  if (forceFull) reasons.add("Full validation was requested");
  if (trigger !== "pull_request") reasons.add("Trigger requires full validation");
  if (!paths.length) reasons.add("Empty diff cannot establish impact");
  let hasFeature = false;
  for (const path of paths) {
    if (((path.startsWith("docs/") && path.endsWith(".md")) && !path.startsWith("docs/security/") && !path.startsWith("docs/operations/") && path !== "docs/quality/CI_CONTRACTS.md") || path === "README.md") continue;
    const match = /^src\/features\/([^/]+)\/(.+)$/.exec(path);
    // Content generation, parsing, unregistered tests, and contact's security boundary
    // are deliberately outside this narrow allowlist.
    if (!match || !Object.hasOwn(FEATURE_SPECS, match[1]) || !/\.(?:tsx?|css)$/.test(match[2]) || /(?:^|\/)(?:content|__tests__)(?:\/|$)/.test(match[2]) || /(?:^|[./-])(?:test|spec|parse|parser|validate|validation)(?:[./-]|$)/i.test(match[2])) {
      full = true;
      reasons.add(`Full validation for ${path}`);
      continue;
    }
    hasFeature = true;
    features.add(match[1]);
    reasons.add(`Feature impact: ${match[1]}`);
  }
  const tier = full ? "full" : hasFeature ? "targeted" : "docs";
  if (tier === "docs") reasons.add("Only allowlisted documentation changed; quality and source security checks remain required");
  const specs = new Set(COMMON_SPECS);
  for (const feature of features) for (const spec of FEATURE_SPECS[feature]) specs.add(spec);
  const targetedValidators = [...TARGETED_VALIDATORS];
  if (features.has('projects') || features.has('research')) targetedValidators.push('cross-browser');
  targetedValidators.sort();
  return {
    schemaVersion: 1, policyVersion: 1, tier, baseSha, headSha, changedPaths: paths, trigger, forceFull,
    features: [...features].sort(),
    validators: tier === "full" ? [...ALL_VALIDATORS] : tier === "docs" ? ["quality", "security"] : targetedValidators,
    chromiumSpecs: tier === "full" ? ["*"] : tier === "docs" ? [] : [...specs].map((spec) => `tests/e2e/${spec}`).sort(),
    reasons: [...reasons].sort(),
  };
}

/** Reject altered, stale, noncanonical, or incomplete serialized plans. */
export function parseImpactPlan(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid impact plan");
  const expected = createImpactPlan(value);
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys) ||
      expectedKeys.some((key) => JSON.stringify(value[key]) !== JSON.stringify(expected[key]))) {
    throw new TypeError("Contradictory or noncanonical impact plan");
  }
  return expected;
}
