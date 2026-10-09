import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCloudflarePagesProject } from "./cloudflarePagesPreflight.mjs";

const accountId = "a".repeat(32);
const apiToken = "test-token";
const validProject = {
  success: true,
  result: {
    name: "smart-portfolio",
    subdomain: "smart-portfolio-bds.pages.dev",
    production_branch: "main"
  }
};

function response(value, options) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...options
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Cloudflare Pages deployment preflight", () => {
  it("reads only the reviewed project endpoint and accepts its exact live identity", async () => {
    const calls = [];
    const fetcher = async (...args) => {
      calls.push(args);
      return response(validProject);
    };

    await expect(verifyCloudflarePagesProject({ accountId, apiToken, fetcher })).resolves.toEqual({
      name: "smart-portfolio",
      subdomain: "smart-portfolio-bds.pages.dev",
      productionBranch: "main"
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
    ["a non-boolean success field", { ...validProject, success: "true" }],
    ["a malformed project response", { success: true, result: "not-a-project" }]
  ])("rejects %s", async (_label, body) => {
    await expect(
      verifyCloudflarePagesProject({ accountId, apiToken, fetcher: async () => response(body) })
    ).rejects.toThrow(/preflight rejected/);
  });

  it("rejects inaccessible and redirect responses without following them", async () => {
    for (const status of [401, 404, 500, 302]) {
      await expect(
        verifyCloudflarePagesProject({
          accountId,
          apiToken,
          fetcher: async () => response(validProject, { status, headers: { location: "https://other.example" } })
        })
      ).rejects.toThrow(/preflight rejected/);
    }
  });

  it("enforces one whole-operation deadline when response headers stall", async () => {
    vi.useFakeTimers();
    let signal;
    const result = verifyCloudflarePagesProject({
      accountId,
      apiToken,
      fetcher: (_url, init) => {
        signal = init.signal;
        return new Promise(() => undefined);
      }
    });
    const assertion = expect(result).rejects.toThrow(/preflight rejected/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(signal.aborted).toBe(true);
  });

  it("enforces the deadline and cancels a stalled response body without waiting for cancellation", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise(() => undefined));
    const result = verifyCloudflarePagesProject({
      accountId,
      apiToken,
      fetcher: async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: { getReader: () => ({ read: () => new Promise(() => undefined), cancel }) }
      })
    });
    const assertion = expect(result).rejects.toThrow(/preflight rejected/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized and malformed bodies without waiting for a stalled cancellation", async () => {
    const cancel = vi.fn(() => new Promise(() => undefined));
    await expect(
      verifyCloudflarePagesProject({
        accountId,
        apiToken,
        fetcher: async () => ({
          ok: true,
          status: 200,
          headers: new Headers(),
          body: {
            getReader: () => ({
              read: async () => ({ done: false, value: new Uint8Array(32 * 1024 + 1) }),
              cancel
            })
          }
        })
      })
    ).rejects.toThrow(/preflight rejected/);
    expect(cancel).toHaveBeenCalledTimes(1);

    await expect(
      verifyCloudflarePagesProject({ accountId, apiToken, fetcher: async () => new Response("{", { status: 200 }) })
    ).rejects.toThrow(/preflight rejected/);
  });
});
