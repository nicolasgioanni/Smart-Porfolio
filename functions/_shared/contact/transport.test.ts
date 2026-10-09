import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeadline, fetchWithJsonTimeout, fetchWithTimeout } from "./transport";

function stalledBody(onCancel: () => void): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
      cancel: () => {
        onCancel();
        return new Promise<void>(() => undefined);
      }
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("bounded provider transport", () => {
  it("cancels an unread body when the response callback rejects", async () => {
    let cancellations = 0;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stalledBody(() => {
      cancellations += 1;
    })));

    await expect(
      fetchWithJsonTimeout("https://provider.example/test", {}, 1_000, 1_024, async () => {
        throw new Error("reject response");
      })
    ).resolves.toBeUndefined();

    expect(cancellations).toBe(1);
  });

  it("returns at its own deadline and disposes a late response from a fetch that ignores abort", async () => {
    vi.useFakeTimers();
    let cancellations = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(() => resolve(stalledBody(() => {
              cancellations += 1;
            })), 2_000);
          })
      )
    );

    const result = fetchWithTimeout("https://provider.example/test", {}, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(cancellations).toBe(1);
  });

  it("uses the parent deadline for an ignored abort and a stalled JSON body", async () => {
    vi.useFakeTimers();
    const parent = createDeadline(500);
    let aborts = 0;
    let cancellations = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        init?.signal?.addEventListener("abort", () => {
          aborts += 1;
        });
        return Promise.resolve(stalledBody(() => {
          cancellations += 1;
        }));
      })
    );

    const result = fetchWithJsonTimeout(
      "https://provider.example/test",
      {},
      5_000,
      1_024,
      async (_response, readJson) => readJson(),
      parent
    );
    await vi.advanceTimersByTimeAsync(500);

    await expect(result).resolves.toBeUndefined();
    expect(aborts).toBe(1);
    expect(cancellations).toBe(1);
    parent.clear();
  });
});
