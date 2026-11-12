const reviewedSchema = "https://raw.githubusercontent.com/cloudflare/workers-sdk/main/packages/wrangler/config-schema.json";
const reviewedProject = "smart-portfolio";
const rateLimitBinding = "CONTACT_RATE_LIMIT_DB";
const publicRuntimeVariables = Object.freeze([
  "CONTACT_ALLOWED_ORIGINS",
  "CONTACT_FROM_EMAIL",
  "CONTACT_REPLY_TO_EMAIL",
  "TURNSTILE_ALLOWED_HOSTNAMES"
]);
const runtimeSecrets = Object.freeze([
  "TURNSTILE_SECRET_KEY",
  "RESEND_API_KEY",
  "CONTACT_RECIPIENT_EMAIL",
  "CONTACT_AUDIT_HMAC_KEY"
]);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const zeroUuid = "00000000-0000-0000-0000-000000000000";

function fail(message) {
  throw new Error(`Sealed runtime configuration ${message}.`);
}

function exactObject(value, requiredKeys, optionalKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const keys = Object.keys(value);
  if (requiredKeys.some((key) => !Object.hasOwn(value, key)) || keys.some((key) => !allowed.has(key))) {
    fail(`${label} has unsupported fields`);
  }
  return value;
}

function compatibility(value, label, fallback) {
  const date = Object.hasOwn(value, "compatibility_date") ? value.compatibility_date : fallback?.compatibilityDate;
  const flags = Object.hasOwn(value, "compatibility_flags") ? value.compatibility_flags : fallback?.compatibilityFlags ?? [];
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`${label} compatibility date is invalid`);
  if (!Array.isArray(flags) || flags.some((flag) => typeof flag !== "string" || !flag.trim()) || new Set(flags).size !== flags.length) {
    fail(`${label} compatibility flags are invalid`);
  }
  return { compatibilityDate: date, compatibilityFlags: [...flags] };
}

function sameCompatibility(left, right) {
  return left.compatibilityDate === right.compatibilityDate && left.compatibilityFlags.length === right.compatibilityFlags.length &&
    left.compatibilityFlags.every((flag, index) => flag === right.compatibilityFlags[index]);
}

function validateRuntimeVariables(value, label) {
  exactObject(value, publicRuntimeVariables, [], label);
  for (const name of publicRuntimeVariables) {
    if (typeof value[name] !== "string" || !value[name].trim()) fail(`${label} contains an invalid public variable`);
  }
}

function validateRateLimitBinding(value, target) {
  const expectedKeys = target === "production"
    ? ["binding", "database_name", "database_id", "preview_database_id", "migrations_dir"]
    : ["binding", "database_name", "database_id", "migrations_dir"];
  exactObject(value, expectedKeys, [], `${target} D1 binding`);
  if (value.binding !== rateLimitBinding || value.database_name !== `smart-portfolio-contact-rate-limit-${target}` ||
      typeof value.database_id !== "string" || !uuid.test(value.database_id) || value.database_id === zeroUuid || value.migrations_dir !== "migrations" ||
      (target === "production" && value.preview_database_id !== "contact-rate-limit-local")) {
    throw new Error("Invalid or unbound environment-specific contact database.");
  }
  return { ...value };
}

function selectOneBinding(value, target) {
  if (!Array.isArray(value) || value.length !== 1) fail(`${target} must declare exactly one D1 binding`);
  return validateRateLimitBinding(value[0], target);
}

function selectedTarget(target, targets, rootCompatibility) {
  if (target === undefined) return null;
  if (target === "local") return { ...rootCompatibility, binding: null };
  if (target === "production" || target === "preview") return targets[target];
  fail("target is invalid");
}

/**
 * Parses the complete reviewed Pages runtime configuration without reading the
 * filesystem or environment. Both deployment targets are checked together so
 * a sealed worker can never compile with a different effective compatibility
 * setting than its preview deployment.
 */
export function validateRuntimeConfig(config, { target, toolchain } = {}) {
  exactObject(config,
    ["$schema", "name", "pages_build_output_dir", "compatibility_date", "d1_databases", "vars", "env"],
    ["compatibility_flags"], "root configuration");
  if (config.$schema !== reviewedSchema || config.name !== reviewedProject || config.pages_build_output_dir !== "./out") {
    fail("does not identify the reviewed Pages project and output directory");
  }
  const rootCompatibility = compatibility(config, "root", undefined);
  validateRuntimeVariables(config.vars, "production runtime variables");
  const productionBinding = selectOneBinding(config.d1_databases, "production");
  exactObject(config.env, ["preview"], [], "environment configuration");
  const preview = exactObject(config.env.preview, ["d1_databases", "vars"], ["compatibility_date", "compatibility_flags"], "preview configuration");
  validateRuntimeVariables(preview.vars, "preview runtime variables");
  const previewBinding = selectOneBinding(preview.d1_databases, "preview");
  const previewCompatibility = compatibility(preview, "preview", rootCompatibility);
  if (!sameCompatibility(rootCompatibility, previewCompatibility)) fail("preview compatibility differs from the compiled runtime");
  if (productionBinding.database_id === previewBinding.database_id) throw new Error("Production and preview databases must remain separate.");

  const targets = {
    production: { ...rootCompatibility, binding: productionBinding },
    preview: { ...previewCompatibility, binding: previewBinding }
  };
  const selected = selectedTarget(target, targets, rootCompatibility);
  if (toolchain !== undefined) {
    if (!selected || !toolchain || typeof toolchain !== "object" || Array.isArray(toolchain) ||
        toolchain.compatibilityDate !== selected.compatibilityDate || !Array.isArray(toolchain.compatibilityFlags) ||
        toolchain.compatibilityFlags.length !== selected.compatibilityFlags.length ||
        toolchain.compatibilityFlags.some((flag, index) => flag !== selected.compatibilityFlags[index])) {
      fail("does not match the sealed candidate compatibility settings");
    }
  }
  return { ...rootCompatibility, targets, target: selected };
}

export const sealedRuntimeConfigContracts = Object.freeze({ publicRuntimeVariables, runtimeSecrets });
