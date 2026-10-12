// @vitest-environment node
import { describe, expect, it } from "vitest";
import { downloadPinnedTool, readPinnedTools, sha256 } from "./installPinnedTool.mjs";

describe("pinned security tool installer", () => {
  it("uses committed HTTPS GitHub release descriptors with immutable SHA-256 digests", async () => {
    const tools = await readPinnedTools();
    expect(Object.keys(tools).sort()).toEqual(["actionlint", "gitleaks", "opa", "terraform", "zizmor"]);
    for (const descriptor of Object.values(tools)) {
      expect(descriptor.url).toMatch(/^https:\/\/(?:github\.com|releases\.hashicorp\.com)\//);
      expect(descriptor.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("rejects redirects away from HTTPS, network failures, and digest mismatches", async () => {
    const body = Buffer.from("tool payload");
    const descriptor = { url: "https://github.com/example/tool/releases/download/v1/tool", sha256: sha256(body), archive: "raw", executable: "tool" };
    await expect(downloadPinnedTool(descriptor, async () => ({ ok: true, url: "http://example.test/tool", arrayBuffer: async () => body }))).rejects.toThrow("outside HTTPS");
    await expect(downloadPinnedTool(descriptor, async () => ({ ok: false, status: 503 }))).rejects.toThrow("HTTP 503");
    await expect(downloadPinnedTool({ ...descriptor, sha256: "0".repeat(64) }, async () => ({ ok: true, url: descriptor.url, arrayBuffer: async () => body }))).rejects.toThrow("digest");
  });
});
