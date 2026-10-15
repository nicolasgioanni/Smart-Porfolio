// @vitest-environment node
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileReleaseOutput, createSealedPackage } from "./lifecycle.mjs";
import { sealedRuntimeConfigContracts, validateRuntimeConfig } from "./runtimeConfig.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const temporaryDirectories = [];

async function currentConfig() {
  return JSON.parse(await readFile(path.join(projectRoot, "wrangler.jsonc"), "utf8"));
}

afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true }))));

describe("sealed Pages runtime configuration admission", () => {
  it("admits the reviewed production and preview targets without freezing reviewed public values", async () => {
    const config = await currentConfig();
    const production = validateRuntimeConfig(config, { target: "production" }).target;
    const preview = validateRuntimeConfig(config, { target: "preview" }).target;

    expect(production.binding).toMatchObject({ binding: "CONTACT_RATE_LIMIT_DB", database_name: "smart-portfolio-contact-rate-limit-production" });
    expect(preview.binding).toMatchObject({ binding: "CONTACT_RATE_LIMIT_DB", database_name: "smart-portfolio-contact-rate-limit-preview" });
    expect(preview.compatibilityDate).toBe(production.compatibilityDate);
    const changedPublicValue = structuredClone(config);
    changedPublicValue.vars.CONTACT_FROM_EMAIL = "Operator <notifications@example.test>";
    expect(validateRuntimeConfig(changedPublicValue, { target: "production" }).target.binding.database_name)
      .toBe("smart-portfolio-contact-rate-limit-production");
  });

  it("rejects extra, missing, duplicated, malformed, and target-mismatched D1 bindings", async () => {
    const changes = [
      (config) => config.d1_databases.push({ ...config.d1_databases[0], binding: "OTHER_DB" }),
      (config) => { config.d1_databases = []; },
      (config) => { config.d1_databases[0].database_id = "not-a-uuid"; },
      (config) => { config.d1_databases[0].database_id = "00000000-0000-0000-0000-000000000000"; },
      (config) => { config.env.preview.d1_databases[0].database_name = "smart-portfolio-contact-rate-limit-production"; },
      (config) => { config.env.preview.d1_databases[0].database_id = config.d1_databases[0].database_id; }
    ];
    for (const change of changes) {
      const config = await currentConfig();
      change(config);
      expect(() => validateRuntimeConfig(config, { target: "production" })).toThrow();
    }
  });

  it("rejects root and preview capability bindings outside the reviewed D1 contract", async () => {
    const changes = [
      (config) => { config.r2_buckets = [{ binding: "AUDIT_ARCHIVE", bucket_name: "archive" }]; },
      (config) => { config.queues = { producers: [{ binding: "AUDIT_QUEUE", queue: "audit" }] }; },
      (config) => { config.env.preview.r2_buckets = [{ binding: "AUDIT_ARCHIVE", bucket_name: "archive" }]; },
      (config) => { config.env.preview.queues = { producers: [{ binding: "AUDIT_QUEUE", queue: "audit" }] }; }
    ];
    for (const change of changes) {
      const config = await currentConfig();
      change(config);
      expect(() => validateRuntimeConfig(config, { target: "preview" })).toThrow("unsupported fields");
    }
  });

  it("rejects preview compatibility overrides that diverge from the compiled worker", async () => {
    const dateMismatch = await currentConfig();
    dateMismatch.env.preview.compatibility_date = "2026-08-28";
    expect(() => validateRuntimeConfig(dateMismatch, { target: "preview" })).toThrow("preview compatibility differs");

    const flagsMismatch = await currentConfig();
    flagsMismatch.compatibility_flags = ["nodejs_compat"];
    flagsMismatch.env.preview.compatibility_flags = [];
    expect(() => validateRuntimeConfig(flagsMismatch, { target: "preview" })).toThrow("preview compatibility differs");

    const sealedMismatch = await currentConfig();
    expect(() => validateRuntimeConfig(sealedMismatch, {
      target: "production",
      toolchain: { compatibilityDate: "2026-08-28", compatibilityFlags: [] }
    })).toThrow("sealed candidate compatibility");
  });

  it("rejects every runtime secret and unknown serialized variable", async () => {
    for (const secret of sealedRuntimeConfigContracts.runtimeSecrets) {
      const config = await currentConfig();
      config.vars[secret] = "redacted";
      expect(() => validateRuntimeConfig(config, { target: "production" })).toThrow("unsupported fields");
    }
    const unknown = await currentConfig();
    unknown.env.preview.vars.UNRELATED_RUNTIME_VALUE = "unexpected";
    expect(() => validateRuntimeConfig(unknown, { target: "preview" })).toThrow("unsupported fields");
  });

  it("rejects invalid source configuration before the compile stage writes output", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "runtime-config-compile-"));
    temporaryDirectories.push(root);
    const config = await currentConfig();
    config.env.preview.queues = { producers: [{ binding: "AUDIT_QUEUE", queue: "audit" }] };
    await writeFile(path.join(root, "wrangler.jsonc"), `${JSON.stringify(config)}\n`, "utf8");

    await expect(compileReleaseOutput({ projectRoot: root, outDirectory: "out", sourceCommit: "a".repeat(40) }))
      .rejects.toThrow("unsupported fields");
    await expect(access(path.join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects invalid source configuration before the package stage writes a release", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "runtime-config-package-"));
    temporaryDirectories.push(root);
    const config = await currentConfig();
    config.vars.TURNSTILE_SECRET_KEY = "redacted";
    await writeFile(path.join(root, "wrangler.jsonc"), `${JSON.stringify(config)}\n`, "utf8");
    const releaseDirectory = path.join(root, "release");

    await expect(createSealedPackage({
      projectRoot: root,
      outDirectory: "out",
      releaseDirectory,
      sourceCommit: "a".repeat(40),
      target: "production",
      snapshotDigest: "b".repeat(64),
      snapshotRecordDigest: "c".repeat(64),
      publicBuildInputDigest: "d".repeat(64),
      producer: "1:1:1"
    })).rejects.toThrow("unsupported fields");
    await expect(access(releaseDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
