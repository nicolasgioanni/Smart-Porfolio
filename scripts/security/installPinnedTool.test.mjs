// @vitest-environment node
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { downloadPinnedTool, installPinnedTool, readPinnedTools, sha256, writeVerifiedPayload } from "./installPinnedTool.mjs";

function bodyResponse(chunks, options = {}) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      }
    }),
    options
  );
}

describe("pinned security tool installer", () => {
  it("uses committed HTTPS GitHub release descriptors with immutable SHA-256 digests", async () => {
    const tools = await readPinnedTools();
    expect(Object.keys(tools).sort()).toEqual(["actionlint", "gitleaks", "opa", "terraform", "zizmor"]);
    for (const descriptor of Object.values(tools)) {
      expect(descriptor.url).toMatch(/^https:\/\/(?:github\.com|releases\.hashicorp\.com)\//);
      expect(descriptor.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("follows one approved GitHub release redirect without credentials", async () => {
    const body = Buffer.from("tool payload");
    const descriptor = { url: "https://github.com/example/tool/releases/download/v1/tool", sha256: sha256(body), archive: "raw", executable: "tool" };
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      if (requests.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://release-assets.githubusercontent.com/github-production-release-asset/example?signature=trusted" }
        });
      }
      return bodyResponse([body], { status: 200 });
    };

    await expect(downloadPinnedTool(descriptor, fetchImpl)).resolves.toEqual(body);
    expect(requests.map((request) => request.url)).toEqual([
      descriptor.url,
      "https://release-assets.githubusercontent.com/github-production-release-asset/example?signature=trusted"
    ]);
    for (const { options } of requests) {
      expect(options.redirect).toBe("manual");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.headers).toBeUndefined();
    }
  });

  it("accepts the direct HashiCorp download host", async () => {
    const body = Buffer.from("tool payload");
    const descriptor = { url: "https://releases.hashicorp.com/terraform/1.16.5/terraform_1.16.5_linux_amd64.zip", sha256: sha256(body), archive: "zip", executable: "terraform" };

    await expect(downloadPinnedTool(descriptor, async () => bodyResponse([body], { status: 200 }))).resolves.toEqual(body);
  });

  it("rejects credentialed sources, unsafe redirects, failed responses, and digest mismatches", async () => {
    const body = Buffer.from("tool payload");
    const descriptor = { url: "https://github.com/example/tool/releases/download/v1/tool", sha256: sha256(body), archive: "raw", executable: "tool" };
    let fetchCalls = 0;
    await expect(downloadPinnedTool({ ...descriptor, url: "https://user:secret@github.com/example/tool/releases/download/v1/tool" }, async () => {
      fetchCalls += 1;
      return bodyResponse([body], { status: 200 });
    })).rejects.toThrow("approved HTTPS source");
    expect(fetchCalls).toBe(0);
    await expect(downloadPinnedTool(descriptor, async () => new Response(null, { status: 302, headers: { location: "https://example.test/tool" } }))).rejects.toThrow("approved download hosts");
    await expect(downloadPinnedTool(descriptor, async () => new Response(null, { status: 503 }))).rejects.toThrow("HTTP 503");
    await expect(downloadPinnedTool({ ...descriptor, sha256: "0".repeat(64) }, async () => bodyResponse([body], { status: 200 }))).rejects.toThrow("digest");
  });

  it("bounds streamed payloads and cancels stalled streams at the whole-download deadline", async () => {
    const body = Buffer.from("tool payload");
    const descriptor = { url: "https://github.com/example/tool/releases/download/v1/tool", sha256: sha256(body), archive: "raw", executable: "tool" };
    await expect(downloadPinnedTool(descriptor, async () => bodyResponse([Buffer.from("12")], { status: 200 }), { maximumBytes: 1 })).rejects.toThrow("invalid size");

    let cancelled = 0;
    const stalledResponse = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: new ReadableStream({
        pull() {
          return new Promise(() => {});
        },
        cancel() {
          cancelled += 1;
        }
      })
    };
    await expect(downloadPinnedTool(descriptor, async () => stalledResponse, { timeoutMs: 10 })).rejects.toThrow("timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelled).toBe(1);
  });

  it("writes digest-verified raw payloads through an exclusive no-follow staging handle", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-pinned-tool-"));
    const body = Buffer.from("#!/usr/bin/env node\\nprocess.exit(0);\\n");
    const descriptor = {
      url: "https://github.com/example/tool/releases/download/v1/tool",
      sha256: sha256(body), archive: "raw", executable: "tool"
    };
    try {
      const executable = await installPinnedTool("fixture", path.join(root, "installed"), {
        fetchImpl: async () => bodyResponse([body], { status: 200 }),
        readTools: async () => ({ fixture: descriptor })
      });
      expect(await readFile(executable)).toEqual(body);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not stage or install a payload whose digest fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-pinned-tool-"));
    const body = Buffer.from("untrusted payload");
    const descriptor = {
      url: "https://github.com/example/tool/releases/download/v1/tool",
      sha256: "0".repeat(64), archive: "raw", executable: "tool"
    };
    let commandRan = false;
    try {
      await expect(
        installPinnedTool("fixture", path.join(root, "installed"), {
          fetchImpl: async () => bodyResponse([body], { status: 200 }),
          commandRunner: async () => {
            commandRan = true;
          },
          readTools: async () => ({ fixture: descriptor })
        })
      ).rejects.toThrow("digest");

      expect(commandRan).toBe(false);
      await expect(readFile(path.join(root, "installed", "fixture", "tool"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not replace an existing staging payload", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-pinned-tool-"));
    const payloadPath = path.join(root, "download");
    const original = Buffer.from("existing payload");
    try {
      await writeFile(payloadPath, original, { mode: 0o600 });

      await expect(writeVerifiedPayload(payloadPath, Buffer.from("replacement"))).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(payloadPath)).toEqual(original);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not follow a pre-existing staging symlink", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-pinned-tool-"));
    const payloadPath = path.join(root, "download");
    const protectedPath = path.join(root, "protected");
    const original = Buffer.from("protected payload");
    try {
      await writeFile(protectedPath, original, { mode: 0o600 });
      await symlink(protectedPath, payloadPath);

      await expect(writeVerifiedPayload(payloadPath, Buffer.from("replacement"))).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(protectedPath)).toEqual(original);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
