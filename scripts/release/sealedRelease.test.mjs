// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArtifactManifest } from "../artifactIntegrity.mjs";
import { packageSealedRelease, parseReleaseManifest, verifySealedRelease } from "./sealedRelease.mjs";

const temporaryDirectories = [];
const candidate = {
  sourceCommit: "a".repeat(40), contentHash: "b".repeat(64), contentSnapshotHash: "c".repeat(64), snapshotRecordDigest: "d".repeat(64),
  publicBuildInputDigest: "e".repeat(64), migrationsHash: "f".repeat(64), wranglerConfigHash: "0".repeat(64), sourceMode: "remote", target: "preview",
  producer: { kind: "github-actions", runId: "31", runNumber: 12, attempt: 2 },
  toolchain: { node: "v22.23.3", next: "16.4.0", wrangler: "4.148.0", compatibilityDate: "2026-08-27", compatibilityFlags: [], lockfileHash: "1".repeat(64) }
};

const digest = (value) => createHash("sha256").update(value).digest("hex");
async function migrationDigest(directory) {
  const body = await readFile(path.join(directory, "0001_fixture.sql"));
  return digest(Buffer.concat([Buffer.from("0001_fixture.sql\0"), body, Buffer.from("\0")]));
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sealed-release-test-"));
  temporaryDirectories.push(root);
  const out = path.join(root, "out");
  const migrations = path.join(root, "migrations");
  await mkdir(path.join(out, "_next"), { recursive: true });
  await mkdir(migrations, { recursive: true });
  await writeFile(path.join(out, "index.html"), "<main>fixture</main>");
  await writeFile(path.join(out, "_worker.js"), "export default { fetch() { return new Response('fixture'); } };");
  await writeFile(path.join(out, "_routes.json"), '{"version":1,"include":["/api/contact","/api/contact/verify"],"exclude":[]}\n');
  await writeFile(path.join(out, "content-version.json"), JSON.stringify({ schemaVersion: 2, commitSha: candidate.sourceCommit, contentHash: candidate.contentHash, generatedAt: "2026-01-01T00:00:00.000Z", deployedAt: "2026-01-01T00:00:01.000Z", target: candidate.target, publicBuildInputDigest: candidate.publicBuildInputDigest, producer: candidate.producer }));
  await writeFile(path.join(out, "_next", "fixture.js"), "export {};");
  await writeFile(path.join(migrations, "0001_fixture.sql"), "select 1;\n");
  const configPath = path.join(root, "wrangler.jsonc");
  await writeFile(configPath, '{"name":"fixture","compatibility_date":"2026-08-27"}\n');
  await createArtifactManifest(out);
  const sealedCandidate = { ...candidate, migrationsHash: await migrationDigest(migrations), wranglerConfigHash: digest(await readFile(configPath)) };
  const sbom = path.join(root, "sbom.cdx.json");
  await writeFile(sbom, '{"bomFormat":"CycloneDX"}\n');
  const release = path.join(root, "release");
  await packageSealedRelease({ outDirectory: out, configPath, migrationsDirectory: migrations, releaseDirectory: release, candidate: sealedCandidate, sbomPath: sbom });
  return { root, release, sealedCandidate };
}

afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true }))));

describe("sealed release package", () => {
  it("binds v2 identity, static output, Functions, config, migrations, and SBOM", async () => {
    const { release, sealedCandidate } = await fixture();
    const manifest = await verifySealedRelease(release, { sourceCommit: sealedCandidate.sourceCommit, target: "preview", publicBuildInputDigest: sealedCandidate.publicBuildInputDigest, snapshotRecordDigest: sealedCandidate.snapshotRecordDigest });
    expect(manifest.files.map((file) => file.path)).toContain("sbom.cdx.json");
    expect(manifest.files.map((file) => file.path)).toContain("out/_worker.js");
  });

  it("rejects substituted static inputs, symlinks, and unsupported manifest paths", async () => {
    const { release } = await fixture();
    await writeFile(path.join(release, "out", "index.html"), "tampered");
    await expect(verifySealedRelease(release)).rejects.toThrow("integrity verification failed");

    const second = await fixture();
    await rm(path.join(second.release, "out", "_worker.js"));
    await symlink("index.html", path.join(second.release, "out", "_worker.js"));
    await expect(verifySealedRelease(second.release)).rejects.toThrow("symbolic link is not allowed");

    expect(() => parseReleaseManifest({ schemaVersion: 1, algorithm: "sha256", candidate, files: [{ path: "../outside", sha256: "a".repeat(64), size: 1 }] })).toThrow("unsafe path");
  });

  it("will not replace an unowned package directory", async () => {
    const { root, release, sealedCandidate } = await fixture();
    const unowned = path.join(root, "unowned", "release");
    await mkdir(unowned, { recursive: true });
    await writeFile(path.join(unowned, "notes.txt"), "unowned");
    await expect(packageSealedRelease({ outDirectory: path.join(release, "out"), configPath: path.join(release, "wrangler.jsonc"), migrationsDirectory: path.join(release, "migrations"), releaseDirectory: unowned, candidate: sealedCandidate, sbomPath: path.join(release, "sbom.cdx.json") })).rejects.toThrow("unowned release directory");
  });
});
