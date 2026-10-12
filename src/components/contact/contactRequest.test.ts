import { afterEach, describe, expect, it, vi } from "vitest";
import { readContactApiResult, requestContactApi } from "@/components/contact/contactRequest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("contact request transport", () => {
  it("returns promptly when a stalled body and its cancellation never settle", async () => {
    const controller = new AbortController();
    const cancel = vi.fn(() => new Promise<void>(() => undefined));
    const response = new Response(new ReadableStream({ cancel }));
    const result = readContactApiResult(response, controller.signal);
    controller.abort();
    await expect(result).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("handles rejected cancellation and a rejected read after an earlier abort", async () => {
    const controller = new AbortController();
    controller.abort();
    const cancel = vi.fn().mockRejectedValue(new Error("stream already closed"));
    const read = vi.fn().mockRejectedValue(new Error("read aborted"));
    const response = { headers: new Headers(), body: { getReader: () => ({ read, cancel }) } } as unknown as Response;
    await expect(readContactApiResult(response, controller.signal)).resolves.toBeNull();
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects malformed and oversized API responses before the form consumes them", async () => {
    const signal = new AbortController().signal;
    await expect(readContactApiResult(new Response("not json"), signal)).resolves.toBeNull();
    await expect(
      readContactApiResult(new Response("{}", { headers: { "Content-Length": "16385" } }), signal)
    ).resolves.toBeNull();
  });

  it("aborts a superseded request and posts bounded same-origin JSON", async () => {
    const previous = new AbortController();
    const controllerRef: { current: AbortController | undefined } = { current: previous };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestContactApi("/api/contact/verify", '{"token":"safe"}', controllerRef, 30_000)).resolves.toMatchObject({
      result: { ok: true }
    });

    expect(previous.signal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contact/verify",
      expect.objectContaining({
        body: '{"token":"safe"}',
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        method: "POST"
      })
    );
    expect(controllerRef.current).toBeUndefined();
  });
});
