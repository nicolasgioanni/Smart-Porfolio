import { afterEach, describe, expect, it, vi } from "vitest";
import { readContactApiResult, requestContactApi } from "@/components/contact/contactRequest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("contact request transport", () => {
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
