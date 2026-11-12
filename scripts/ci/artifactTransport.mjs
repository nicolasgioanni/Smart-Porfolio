import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { repository } from "./plan.mjs";
import {
  parseArtifactReference,
  parseArtifactTransfer,
  verifyArtifactReference,
  verifyArtifactTransfer
} from "./snapshot.mjs";
import { readGithubEvidence } from "./githubEvidence.mjs";

const execute = promisify(execFile);
export const archiveLimit = 256 * 1024 * 1024;

export function validateDownloadLocation(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("GitHub artifact download location is invalid."); }
  // Only a signed location returned by the exact GitHub artifact endpoint is
  // eligible. Never forward the API bearer token to the storage service.
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || !url.search || url.pathname === "/" ||
      !/^[a-z0-9]+\.blob\.core\.windows\.net$/.test(url.hostname)) {
    throw new Error("GitHub artifact download location is outside reviewed storage.");
  }
  return url.href;
}

function verifiedArtifact(referenceValue, metadata, candidate) {
  if (referenceValue && typeof referenceValue === "object" && Object.hasOwn(referenceValue, "recordDigest")) {
    const reference = parseArtifactReference(referenceValue);
    verifyArtifactReference(reference, metadata, candidate);
    return reference;
  }
  const transfer = parseArtifactTransfer(referenceValue);
  verifyArtifactTransfer(transfer, metadata, candidate);
  return transfer;
}

function assertSignal(signal) {
  if (!signal || typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function") {
    throw new Error("Artifact download deadline is invalid.");
  }
}

async function awaitWithAbort(operation, signal) {
  assertSignal(signal);
  if (signal.aborted) throw new Error("Artifact download deadline expired.");
  let abort;
  const aborted = new Promise((_, reject) => {
    abort = () => reject(new Error("Artifact download deadline expired."));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), aborted]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

async function boundedArchive(response, signal) {
  if (response.status !== 200 || !response.body) throw new Error("Original artifact download is unavailable; perform a full affected rerun.");
  const length = response.headers.get("content-length");
  if (length !== null && (!/^[1-9]\d*$/.test(length) || Number(length) > archiveLimit)) throw new Error("Artifact download exceeds its archive budget.");
  const chunks = [], reader = response.body.getReader();
  let size = 0;
  // The independent abort race also bounds a transport whose body stalls after
  // returning headers. Cancellation is best effort and never extends the bound.
  let abort;
  const aborted = new Promise((_, reject) => {
    abort = () => reject(new Error("Artifact download deadline expired."));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      if (Object.prototype.toString.call(value) !== "[object Uint8Array]") {
        throw new Error("Artifact download is malformed.");
      }
      const chunk = Buffer.from(value);
      size += chunk.byteLength;
      if (size > archiveLimit) throw new Error("Artifact download exceeds its archive budget.");
      chunks.push(chunk);
    }
    if (size === 0 || (length !== null && size !== Number(length))) throw new Error("Artifact download is incomplete.");
    return Buffer.concat(chunks);
  } finally {
    signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
  }
}

export async function downloadArtifact(referenceValue, candidate, {
  token, fetchImplementation = fetch, signal = AbortSignal.timeout(120_000)
} = {}) {
  assertSignal(signal);
  const parsedReference = referenceValue && typeof referenceValue === "object" && Object.hasOwn(referenceValue, "recordDigest")
    ? parseArtifactReference(referenceValue)
    : parseArtifactTransfer(referenceValue);
  const metadata = await awaitWithAbort(
    () => readGithubEvidence(`/actions/artifacts/${parsedReference.id}`, { token, fetchImplementation }),
    signal
  );
  const reference = verifiedArtifact(parsedReference, metadata, candidate);
  const redirect = await awaitWithAbort(
    () => fetchImplementation(`https://api.github.com/repos/${repository}/actions/artifacts/${reference.id}/zip`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
      redirect: "manual", signal
    }),
    signal
  );
  void redirect.body?.cancel().catch(() => {});
  if (redirect.status !== 302) throw new Error("Original artifact archive is missing or expired; perform a full affected rerun.");
  const location = validateDownloadLocation(redirect.headers.get("location"));
  const response = await awaitWithAbort(() => fetchImplementation(location, { redirect: "error", signal }), signal);
  const bytes = await boundedArchive(response, signal);
  if (createHash("sha256").update(bytes).digest("hex") !== reference.digest) {
    throw new Error("Artifact archive digest does not match the accepted producer. Extraction is forbidden.");
  }
  return bytes;
}

// Python's standard ZIP reader avoids installing application dependencies in
// the lightweight aggregate. It checks CRCs while reading bounded regular
// files; the wrapper supplies a fresh private directory and a process deadline.
export async function extractArtifact(bytes, destination) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > archiveLimit) throw new Error("Invalid artifact archive bytes.");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "portfolio-archive-"));
  try {
    const archive = path.join(temporary, "artifact.zip");
    await writeFile(archive, bytes, { mode: 0o600, flag: "wx" });
    await execute("python3", [fileURLToPath(new URL("./extractArtifact.py", import.meta.url)), archive, path.resolve(destination)], {
      timeout: 120_000, maxBuffer: 16 * 1024, env: { PATH: process.env.PATH, PYTHONNOUSERSITE: "1" }
    });
  } catch {
    throw new Error("Artifact extraction rejected an unsafe, corrupt, oversized or incomplete archive.");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
