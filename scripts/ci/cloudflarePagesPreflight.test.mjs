// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCloudflarePagesProject } from "./cloudflarePagesPreflight.mjs";

const accountId = "a".repeat(32);
const apiToken = "reviewed-test-token";
const validProject = {
  success: true,
  errors: [],
  result: {
    name: "smart-portfolio",
    subdomain: "smart-portfolio-bds.pages.dev",
    production_branch: "main"
  }
};

function response(value, options = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...options
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Cloudflare Pages deployment preflight", () => {
  it("reads only the reviewed Direct Upload project and accepts its exact identity", async () => {
    const calls = [];
    const fetcher = async (...args) => {
      calls.push(args);
      return response(validProject);
    };

    await expect(verifyCloudflarePagesProject({ accountId, apiToken, fetcher })).resolves.toEqual({
      name: "smart-portfolio",
      subdomain: "smart-portfolio-bds.pages.dev",
      productionBranch: "main",
      source: "direct-upload"
    });
    expect(calls).toEqual([
      [
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/smart-portfolio`,
        expect.objectContaining({
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
          redirect: "manual",
          signal: expect.any(AbortSignal)
        })
      ]
    ]);
  });

  it.each([
    ["a wrong production branch", { ...validProject, result: { ...validProject.result, production_branch: "develop" } }],
    ["a missing production branch", { ...validProject, result: { ...validProject.result, production_branch: undefined } }],
    ["a wrong project", { ...validProject, result: { ...validProject.result, name: "other-project" } }],
    ["a wrong assigned domain", { ...validProject, result: { ...validProject.result, subdomain: "other.pages.dev" } }],
    ["a Git-connected project", { ...validProject, result: { ...validProject.result, source: { type: "github" } } }],
    ["a non-boolean success field", { ...validProject, success: "true" }],
    ["missing error evidence", { ...validProject, errors: undefined }],
    ["contradictory provider errors", { ...validProject, errors: [{ code: 1000, message: "private provider detail" }] }],
    ["a malformed project response", { success: true, result: "not-a-project" }]
  ])("rejects %s with a sanitized error", async (_label, body) => {
    await expect(
      verifyCloudflarePagesProject({ accountId, apiToken, fetcher: async () => response(body) })
    ).rejects.toThrow("Cloudflare Pages preflight rejected the reviewed deployment target.");
  });

  it("rejects missing credentials, inaccessible responses, redirects, and provider error details", async () => {
    const fetcher = vi.fn();
    await expect(verifyCloudflarePagesProject({ accountId: "invalid", apiToken, fetcher })).rejects.toThrow(/preflight rejected/);
    expect(fetcher).not.toHaveBeenCalled();

    for (const result of [
      async () => response(validProject, { status: 401 }),
      async () => response(validProject, { status: 404 }),
      async () => response(validProject, { status: 500 }),
      async () => response(validProject, { headers: { "content-type": "text/html" } }),
      async () => response(validProject, { status: 302, headers: { location: "https://substitute.example" } }),
      async () => { throw new Error(apiToken); }
    ]) {
      await expect(verifyCloudflarePagesProject({ accountId, apiToken, fetcher: result })).rejects.toThrow(
        "Cloudflare Pages preflight rejected the reviewed deployment target."
      );
      await expect(verifyCloudflarePagesProject({ accountId, apiToken, fetcher: result })).rejects.not.toThrow(apiToken);
    }
  });

  it("enforces one operation deadline when response headers stall", async () => {
    vi.useFakeTimers();
    let signal;
    const pending = verifyCloudflarePagesProject({
      accountId,
      apiToken,
      fetcher: (_url, init) => {
        signal = init.signal;
        return new Promise(() => undefined);
      }
    });
    const assertion = expect(pending).rejects.toThrow(/preflight rejected/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(signal.aborted).toBe(true);
  });

  it("cancels a stalled or malformed body without waiting for provider cleanup", async () => {
    vi.useFakeTimers();
    const stalledCancel = vi.fn(() => new Promise(() => undefined));
    const pending = verifyCloudflarePagesProject({
      accountId,
      apiToken,
      fetcher: async () => ({
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        body: { getReader: () => ({ read: () => new Promise(() => undefined), cancel: stalledCancel }) }
      })
    });
    const assertion = expect(pending).rejects.toThrow(/preflight rejected/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(stalledCancel).toHaveBeenCalledOnce();

    vi.useRealTimers();
    const oversizedCancel = vi.fn(() => new Promise(() => undefined));
    await expect(verifyCloudflarePagesProject({
      accountId,
      apiToken,
      fetcher: async () => ({
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        body: { getReader: () => ({ read: async () => ({ done: false, value: new Uint8Array(32 * 1024 + 1) }), cancel: oversizedCancel }) }
      })
    })).rejects.toThrow(/preflight rejected/);
    expect(oversizedCancel).toHaveBeenCalledOnce();
    await expect(verifyCloudflarePagesProject({ accountId, apiToken, fetcher: async () => response("{") })).rejects.toThrow(/preflight rejected/);
  });
});
