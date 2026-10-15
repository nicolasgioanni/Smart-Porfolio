// @vitest-environment node

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { archiveLimit, downloadArtifact, extractArtifact, validateDownloadLocation } from "./artifactTransport.mjs";
import { repository, workflowPath } from "./plan.mjs";

const sha = "a".repeat(40);
const token = "read-only-token";
const artifactId = 9;
const storageLocation = "https://pipelinesactionsprod.blob.core.windows.net/actions/artifact.zip?se=2099-01-01&sig=accepted";
const candidate = {
  schemaVersion: 1,
  repository,
  event: "push",
  ref: "refs/heads/main",
  workflowRef: `${repository}/${workflowPath}@refs/heads/main`,
  workflowSha: sha,
  sourceSha: sha,
  eventSha: sha,
  runHeadSha: sha,
  branchTip: sha,
  pullNumber: null,
  baseBranch: null,
  force: false,
  runId: 12345,
  runNumber: 350,
  producerAttempt: 1
};
const producer = { runId: candidate.runId, runNumber: candidate.runNumber, attempt: 1, job: "browser-e2e" };
const temporary = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function transfer(bytes) {
  return {
    schemaVersion: 1,
    id: artifactId,
    name: "ci-12345-1-receipt-browser-e2e",
    role: "receipt",
    digest: digest(bytes),
    producer
  };
}

function reference(bytes) {
  return { ...transfer(bytes), recordDigest: "b".repeat(64) };
}

function metadata(value, overrides = {}) {
  return {
    id: value.id,
    name: value.name,
    expired: false,
    digest: `sha256:${value.digest}`,
    workflow_run: { id: candidate.runId, head_sha: candidate.runHeadSha },
    ...overrides
  };
}

function archiveResponse(bytes, headers = {}) {
  return new Response(bytes, { status: 200, headers });
}

function redirectResponse(location = storageLocation, status = 302) {
  return new Response(null, { status, headers: location === null ? {} : { Location: location } });
}

function artifactFetcher(value, bytes, { artifactMetadata = metadata(value), redirect = redirectResponse(), storage = archiveResponse(bytes) } = {}) {
  const calls = [];
  const metadataUrl = `https://api.github.com/repos/${repository}/actions/artifacts/${value.id}`;
  const archiveUrl = `${metadataUrl}/zip`;
  const fetchImplementation = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === metadataUrl) return Response.json(artifactMetadata);
    if (url === archiveUrl) return redirect;
    if (url === storageLocation) return storage;
    throw new Error(`Unexpected request ${url}`);
  };
  return { calls, fetchImplementation };
}

async function zip(entries, options = {}) {
  const bundle = new JSZip();
  for (const [name, content] of entries) bundle.file(name, content);
  return bundle.generateAsync({ type: "nodebuffer", compression: "STORE", ...options });
}

function allOffsets(bytes, signature) {
  const offsets = [];
  for (let offset = 0; offset <= bytes.length - signature.length; offset += 1) {
    if (bytes.subarray(offset, offset + signature.length).equals(signature)) offsets.push(offset);
  }
  return offsets;
}

function replaceEvery(bytes, source, replacement) {
  const from = Buffer.from(source);
  const to = Buffer.from(replacement);
  if (from.length !== to.length) throw new Error("Fixture replacement must preserve ZIP metadata lengths.");
  const result = Buffer.from(bytes);
  let replacements = 0;
  for (let offset = 0; offset <= result.length - from.length; offset += 1) {
    if (result.subarray(offset, offset + from.length).equals(from)) {
      to.copy(result, offset);
      replacements += 1;
      offset += from.length - 1;
    }
  }
  if (replacements === 0) throw new Error(`Fixture source ${source} was not found.`);
  return result;
}

function withExternalMode(bytes, mode) {
  const result = Buffer.from(bytes);
  const centralDirectories = allOffsets(result, Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  if (centralDirectories.length === 0) throw new Error("Fixture has no central directory.");
  for (const offset of centralDirectories) result.writeUInt32LE((mode << 16) >>> 0, offset + 38);
  return result;
}

function withExpandedSizes(bytes, size) {
  const result = Buffer.from(bytes);
  const localHeaders = allOffsets(result, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const centralDirectories = allOffsets(result, Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  if (localHeaders.length === 0 || centralDirectories.length === 0) throw new Error("Fixture has no ZIP members.");
  for (const offset of localHeaders) result.writeUInt32LE(size, offset + 22);
  for (const offset of centralDirectories) result.writeUInt32LE(size, offset + 24);
  return result;
}

async function destination(label = "artifact-output-") {
  const parent = await mkdtemp(path.join(os.tmpdir(), label));
  temporary.push(parent);
  return path.join(parent, "extracted");
}

describe("immutable GitHub artifact transport", () => {
  it("reads only the fixed same-repository artifact ID, then sends the API token only to GitHub", async () => {
    const bytes = await zip([["receipt.json", "{}"]]);
    const value = reference(bytes);
    const { calls, fetchImplementation } = artifactFetcher(value, bytes);

    await expect(downloadArtifact(value, candidate, { token, fetchImplementation })).resolves.toEqual(bytes);
    expect(calls.map(({ url }) => url)).toEqual([
      `https://api.github.com/repos/${repository}/actions/artifacts/${artifactId}`,
      `https://api.github.com/repos/${repository}/actions/artifacts/${artifactId}/zip`,
      storageLocation
    ]);
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(new Headers(calls[1].init.headers).get("authorization")).toBe(`Bearer ${token}`);
    expect(new Headers(calls[2].init.headers).get("authorization")).toBeNull();
    expect(calls[1].init.redirect).toBe("manual");
    expect(calls[2].init.redirect).toBe("error");
  });

  it("accepts a validated transfer before the downloaded receipt provides its record digest", async () => {
    const bytes = await zip([["receipt.json", "{}"]]);
    const value = transfer(bytes);
    const { fetchImplementation } = artifactFetcher(value, bytes);

    await expect(downloadArtifact(value, candidate, { token, fetchImplementation })).resolves.toEqual(bytes);
  });

  it("rejects missing, expired, wrong-candidate, substituted, and digest-mismatched producer evidence before acceptance", async () => {
    const bytes = await zip([["receipt.json", "{}"]]);
    const value = reference(bytes);
    const cases = [
      { metadata: null, candidate },
      { metadata: metadata(value, { expired: true }), candidate },
      { metadata: metadata(value, { id: artifactId + 1 }), candidate },
      { metadata: metadata(value, { digest: `sha256:${"c".repeat(64)}` }), candidate },
      { metadata: metadata(value), candidate: { ...candidate, runId: candidate.runId + 1 } }
    ];

    for (const invalid of cases) {
      const { calls, fetchImplementation } = artifactFetcher(value, bytes, { artifactMetadata: invalid.metadata });
      await expect(downloadArtifact(value, invalid.candidate, { token, fetchImplementation })).rejects.toThrow();
      expect(calls).toHaveLength(1);
    }

    const { fetchImplementation } = artifactFetcher(value, Buffer.from("substituted archive"));
    await expect(downloadArtifact(value, candidate, { token, fetchImplementation })).rejects.toThrow("digest");
  });

  it("allows only signed HTTPS Azure Blob locations and refuses second redirects", async () => {
    expect(validateDownloadLocation(storageLocation)).toBe(storageLocation);
    for (const location of [
      "http://pipelinesactionsprod.blob.core.windows.net/actions/artifact.zip?sig=one",
      "https://user@pipelinesactionsprod.blob.core.windows.net/actions/artifact.zip?sig=one",
      "https://pipelinesactionsprod.blob.core.windows.net:444/actions/artifact.zip?sig=one",
      "https://pipelinesactionsprod.blob.core.windows.net/actions/artifact.zip",
      "https://pipelinesactionsprod.blob.core.windows.net/?sig=one",
      "https://storage.example.com/actions/artifact.zip?sig=one"
    ]) {
      expect(() => validateDownloadLocation(location)).toThrow();
    }

    const bytes = await zip([["receipt.json", "{}"]]);
    const value = reference(bytes);
    const firstRedirect = artifactFetcher(value, bytes, { redirect: redirectResponse("https://attacker.example/archive?sig=one") });
    await expect(downloadArtifact(value, candidate, { token, fetchImplementation: firstRedirect.fetchImplementation })).rejects.toThrow("storage");
    expect(firstRedirect.calls).toHaveLength(2);

    const secondRedirect = artifactFetcher(value, bytes, { storage: redirectResponse("https://elsewhere.example/archive?sig=two") });
    await expect(downloadArtifact(value, candidate, { token, fetchImplementation: secondRedirect.fetchImplementation })).rejects.toThrow("unavailable");
    expect(secondRedirect.calls).toHaveLength(3);
  });

  it("rejects oversized, incomplete, malformed, and stalled archive bodies and begins cancellation", async () => {
    const bytes = await zip([["receipt.json", "{}"]]);
    const value = reference(bytes);
    const oversizedHeader = artifactFetcher(value, bytes, {
      storage: archiveResponse(bytes, { "Content-Length": String(archiveLimit + 1) })
    });
    await expect(downloadArtifact(value, candidate, { token, fetchImplementation: oversizedHeader.fetchImplementation })).rejects.toThrow("budget");

    const incomplete = artifactFetcher(value, bytes, {
      storage: archiveResponse(bytes, { "Content-Length": String(bytes.length + 1) })
    });
    await expect(downloadArtifact(value, candidate, { token, fetchImplementation: incomplete.fetchImplementation })).rejects.toThrow("incomplete");

    let malformedCancelled = false;
    const malformedBody = {
      status: 200,
      headers: new Headers(),
      body: {
        getReader() {
          return {
            read: async () => ({ done: false, value: "not archive bytes" }),
            cancel: async () => { malformedCancelled = true; }
          };
        }
      }
    };
    const malformed = artifactFetcher(value, bytes, { storage: malformedBody });
    await expect(downloadArtifact(value, candidate, { token, fetchImplementation: malformed.fetchImplementation })).rejects.toThrow("malformed");
    expect(malformedCancelled).toBe(true);

    let cancelled = false;
    const chunk = new Uint8Array(8 * 1024 * 1024);
    let reads = 0;
    const oversizedBody = {
      status: 200,
      headers: new Headers(),
      body: {
        getReader() {
          return {
            read: async () => ({ done: reads++ > 32, value: chunk }),
            cancel: async () => { cancelled = true; }
          };
        }
      }
    };
    const streamedLimit = artifactFetcher(value, bytes, { storage: oversizedBody });
    await expect(downloadArtifact(value, candidate, { token, fetchImplementation: streamedLimit.fetchImplementation })).rejects.toThrow("budget");
    expect(cancelled).toBe(true);

    let markRead;
    const reading = new Promise((resolve) => { markRead = resolve; });
    let stalledCancelled = false;
    const stalled = {
      status: 200,
      headers: new Headers(),
      body: {
        getReader() {
          return {
            read: () => {
              markRead();
              return new Promise(() => {});
            },
            cancel: async () => { stalledCancelled = true; }
          };
        }
      }
    };
    const controller = new AbortController();
    const stalledTransport = artifactFetcher(value, bytes, { storage: stalled });
    const download = downloadArtifact(value, candidate, { token, fetchImplementation: stalledTransport.fetchImplementation, signal: controller.signal });
    await reading;
    controller.abort();
    await expect(download).rejects.toThrow("deadline");
    expect(stalledCancelled).toBe(true);
  });
});

describe("bounded standard-library ZIP extraction", () => {
  it("extracts ordinary JSZip bytes as nonexecutable files", async () => {
    const output = await destination();
    await extractArtifact(await zip([["nested/receipt.json", "safe"]]), output);
    await expect(readFile(path.join(output, "nested", "receipt.json"), "utf8")).resolves.toBe("safe");
  });

  it("rejects corrupt CRCs, traversal, duplicate names, and case-fold collisions without leaving a destination", async () => {
    const crc = await zip([["safe.txt", "PAYLOAD-CRC-CHECK"]]);
    const corruptCrc = Buffer.from(crc);
    corruptCrc[corruptCrc.indexOf(Buffer.from("PAYLOAD-CRC-CHECK"))] ^= 1;
    const traversal = replaceEvery(await zip([["safe.txt", "safe"]]), "safe.txt", "../x.txt");
    const duplicate = replaceEvery(await zip([["one.txt", "first"], ["two.txt", "second"]]), "two.txt", "one.txt");
    const collision = await zip([["Readme.txt", "first"], ["README.TXT", "second"]]);

    for (const bytes of [corruptCrc, traversal, duplicate, collision]) {
      const output = await destination();
      await expect(extractArtifact(bytes, output)).rejects.toThrow("unsafe, corrupt, oversized or incomplete");
      await expect(readFile(output)).rejects.toThrow();
    }
  });

  it("rejects null names, links, privileged and special ZIP modes, and file-directory collisions", async () => {
    const nullName = replaceEvery(await zip([["bad-name", "safe"]]), "bad-name", "bad\u0000name");
    const symbolicLink = withExternalMode(await zip([["link.txt", "target"]]), 0o120777);
    const setuid = withExternalMode(await zip([["safe.txt", "safe"]]), 0o104644 | 0o4000);
    const fifo = withExternalMode(await zip([["safe.txt", "safe"]]), 0o010644);
    const fileDirectoryCollision = await zip([["file.txt", "safe"], ["file.txt/child.txt", "unsafe"]]);

    for (const bytes of [nullName, symbolicLink, setuid, fifo, fileDirectoryCollision]) {
      const output = await destination();
      await expect(extractArtifact(bytes, output)).rejects.toThrow("unsafe, corrupt, oversized or incomplete");
    }
  });

  it("rejects declared single-file and aggregate expansion budgets before writes", async () => {
    const oversizedFile = withExpandedSizes(await zip([["safe.txt", "safe"]]), 128 * 1024 * 1024 + 1);
    const aggregate = withExpandedSizes(
      await zip([["a.txt", "a"], ["b.txt", "b"], ["c.txt", "c"], ["d.txt", "d"], ["e.txt", "e"]]),
      110 * 1024 * 1024
    );
    for (const bytes of [oversizedFile, aggregate]) {
      const output = await destination();
      await expect(extractArtifact(bytes, output)).rejects.toThrow("unsafe, corrupt, oversized or incomplete");
    }
  });

  it("refuses existing and symlinked destination targets before extraction", async () => {
    const bytes = await zip([["receipt.json", "safe"]]);
    const existing = await destination();
    await writeFile(existing, "preserve");
    await expect(extractArtifact(bytes, existing)).rejects.toThrow("unsafe, corrupt, oversized or incomplete");
    await expect(readFile(existing, "utf8")).resolves.toBe("preserve");

    const parent = await mkdtemp(path.join(os.tmpdir(), "artifact-symlink-"));
    temporary.push(parent);
    const realParent = path.join(parent, "real");
    const linkedParent = path.join(parent, "linked");
    await mkdir(realParent);
    await symlink(realParent, linkedParent);
    await expect(extractArtifact(bytes, path.join(linkedParent, "output"))).rejects.toThrow("unsafe, corrupt, oversized or incomplete");
  });
});
