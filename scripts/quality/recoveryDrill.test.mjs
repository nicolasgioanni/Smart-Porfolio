// @vitest-environment node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArtifactManifest } from "../artifactIntegrity.mjs";
import { packageSealedRelease, parseCandidate, verifySealedRelease } from "../release/sealedRelease.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const wrangler = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const d1Binding = "CONTACT_RATE_LIMIT_DB";
const temporaryDirectories = [];

function credentialFreeChildEnvironment(home) {
  return {
    HOME: home,
    PATH: process.env.PATH ?? "",
    TMPDIR: os.tmpdir(),
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false"
  };
}

function runLocalWrangler(cwd, home, args) {
  return execFileSync(process.execPath, [wrangler, "d1", ...args], {
    cwd,
    encoding: "utf8",
    env: credentialFreeChildEnvironment(home),
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20_000,
    killSignal: "SIGTERM"
  });
}

function executeLocal(configPath, cwd, home, command) {
  return JSON.parse(
    runLocalWrangler(cwd, home, [
      "execute",
      d1Binding,
      "--local",
      "--config",
      configPath,
      "--json",
      "--command",
      command
    ])
  );
}

function rows(configPath, cwd, home) {
  const result = executeLocal(
    configPath,
    cwd,
    home,
    "SELECT submission_id, email_hash, payload_hash, delivery_config_hash, render_version, reserved_at, expires_at FROM contact_rate_reservations ORDER BY submission_id"
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ success: true });
  return result[0].results;
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function directoryDigest(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
      else throw new Error("Recovery fixture migration input is unsupported");
    }
  }
  await visit(directory);
  const digest = createHash("sha256");
  for (const file of files.sort()) {
    digest.update(path.relative(directory, file).split(path.sep).join("/"));
    digest.update("\0");
    digest.update(await readFile(file));
    digest.update("\0");
  }
  return digest.digest("hex");
}

async function createSealedFixture(root) {
  const out = path.join(root, "out");
  const migrations = path.join(root, "migrations");
  const release = path.join(root, "release");
  const config = path.join(root, "wrangler.jsonc");
  const sourceCommit = "a".repeat(40);
  const contentHash = "b".repeat(64);
  const snapshotDigest = "c".repeat(64);
  const snapshotRecordDigest = "d".repeat(64);
  const publicBuildInputDigest = "e".repeat(64);

  await mkdir(path.join(out, "_next"), { recursive: true });
  await cp(path.join(projectRoot, "migrations"), migrations, { recursive: true });
  await Promise.all([
    writeFile(path.join(out, "index.html"), "<main>recovery fixture</main>"),
    writeFile(path.join(out, "_worker.js"), "export default { fetch() { return new Response('fixture'); } };\n"),
    writeFile(path.join(out, "_routes.json"), '{"version":1,"include":["/api/contact","/api/contact/verify"],"exclude":[]}\n'),
    writeFile(path.join(out, "_next", "fixture.js"), "export {};\n"),
    writeFile(
      path.join(out, "content-version.json"),
      JSON.stringify({
        schemaVersion: 2,
        commitSha: sourceCommit,
        contentHash,
        generatedAt: "2026-10-12T00:00:00.000Z",
        deployedAt: "2026-10-12T00:00:01.000Z",
        target: "local",
        publicBuildInputDigest,
        producer: { kind: "local", runId: "local", runNumber: null, attempt: null }
      }) + "\n"
    ),
    writeFile(config, '{"name":"recovery-fixture","compatibility_date":"2026-08-27"}\n')
  ]);
  await createArtifactManifest(out);

  const candidate = {
    sourceCommit,
    contentHash,
    contentSnapshotHash: snapshotDigest,
    snapshotRecordDigest,
    publicBuildInputDigest,
    migrationsHash: await directoryDigest(migrations),
    wranglerConfigHash: await sha256(config),
    sourceMode: "templates",
    target: "local",
    producer: { kind: "local", runId: "local", runNumber: null, attempt: null },
    toolchain: {
      node: "v22.23.3",
      next: "16.4.0",
      wrangler: "4.148.0",
      compatibilityDate: "2026-08-27",
      compatibilityFlags: [],
      lockfileHash: "f".repeat(64)
    }
  };
  const sbom = path.join(root, "sbom.cdx.json");
  await writeFile(sbom, '{"bomFormat":"CycloneDX"}\n');
  await packageSealedRelease({
    outDirectory: out,
    configPath: config,
    migrationsDirectory: migrations,
    releaseDirectory: release,
    candidate,
    sbomPath: sbom
  });
  return { candidate, release };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("local recovery drills", () => {
  it("exports and restores a 0003-migrated local D1 reservation without changing its identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-d1-recovery-"));
    temporaryDirectories.push(root);
    const before = path.join(root, "before");
    const after = path.join(root, "after");
    const home = path.join(root, "credential-free-home");
    const backup = path.join(root, "contact-rate-limit-backup.sql");

    await mkdir(home, { recursive: true });
    for (const directory of [before, after]) {
      await mkdir(directory, { recursive: true });
      await cp(path.join(projectRoot, "migrations"), path.join(directory, "migrations"), { recursive: true });
      await writeFile(
        path.join(directory, "wrangler.jsonc"),
        JSON.stringify({
          name: "local-recovery-drill",
          compatibility_date: "2026-08-27",
          d1_databases: [{
            binding: d1Binding,
            database_name: "local-recovery-drill",
            database_id: "11111111-1111-4111-8111-111111111111",
            migrations_dir: "migrations"
          }]
        }) + "\n"
      );
    }

    const beforeConfig = path.join(before, "wrangler.jsonc");
    const afterConfig = path.join(after, "wrangler.jsonc");
    runLocalWrangler(before, home, ["migrations", "apply", d1Binding, "--local", "--config", beforeConfig]);
    executeLocal(
      beforeConfig,
      before,
      home,
      "INSERT INTO contact_rate_reservations (submission_id, email_hash, payload_hash, delivery_config_hash, render_version, reserved_at, expires_at) VALUES ('11111111-1111-4111-8111-111111111111', 'email-hash', 'payload-hash', 'delivery-hash', 1, 1800000000, 1800086400)"
    );
    const expected = rows(beforeConfig, before, home);

    const schema = executeLocal(
      beforeConfig,
      before,
      home,
      "SELECT name FROM pragma_table_info('contact_rate_reservations') ORDER BY cid"
    );
    expect(schema[0].results.map((column) => column.name)).toEqual([
      "submission_id",
      "email_hash",
      "reserved_at",
      "expires_at",
      "payload_hash",
      "delivery_config_hash",
      "render_version"
    ]);

    runLocalWrangler(before, home, [
      "export",
      d1Binding,
      "--local",
      "--config",
      beforeConfig,
      "--output",
      backup,
      "--table",
      "contact_rate_reservations",
      "--no-schema",
      "--skip-confirmation"
    ]);
    const exported = await readFile(backup, "utf8");
    expect(exported).toContain("contact_rate_reservations");
    expect(exported).toContain("delivery-hash");

    runLocalWrangler(after, home, ["migrations", "apply", d1Binding, "--local", "--config", afterConfig]);
    runLocalWrangler(after, home, ["execute", d1Binding, "--local", "--config", afterConfig, "--file", backup]);
    expect(rows(afterConfig, after, home)).toEqual(expected);
  }, 60_000);

  it("rejects a tampered v2 sealed package and recovers only by restoring its prior verified envelope", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-sealed-recovery-"));
    temporaryDirectories.push(root);
    const { candidate, release } = await createSealedFixture(root);
    const backup = path.join(root, "verified-release-backup");
    const verified = await verifySealedRelease(release, candidate);
    expect(verified.files.map((file) => file.path)).toContain("migrations/0003_contact_delivery_rendering.sql");
    expect(verified.files.some((file) => file.path.includes("audit"))).toBe(false);
    expect(() => parseCandidate({ ...candidate, collectorBundleHash: "0".repeat(64) })).toThrow(
      "candidate has unsupported fields"
    );
    await cp(release, backup, { recursive: true, force: false, errorOnExist: true });

    await writeFile(path.join(release, "out", "_worker.js"), "tampered worker");
    await expect(verifySealedRelease(release, candidate)).rejects.toThrow("integrity verification failed");

    await rm(release, { recursive: true, force: true });
    await cp(backup, release, { recursive: true, force: false, errorOnExist: true });
    await expect(verifySealedRelease(release, candidate)).resolves.toMatchObject({ candidate });
  });
});
