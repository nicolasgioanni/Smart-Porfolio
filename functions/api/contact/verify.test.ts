import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_ACTION,
  CONTACT_TICKET_COOKIE_NAME,
  CONTACT_TICKET_MAX_AGE_SECONDS,
  MAX_REQUEST_BYTES,
  hasValidContactTicket,
  readJsonBody,
  type ContactEnv
} from "../../_shared/contact";
import { oversizedJsonResponse, stalledJsonResponse } from "../../testSupport/streams";
import { onRequest } from "./verify";

const submissionId = "4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const env = {
  CONTACT_ALLOWED_ORIGINS: "https://nicolasmgioanni.dev",
  TURNSTILE_ALLOWED_HOSTNAMES: "nicolasmgioanni.dev,www.nicolasmgioanni.dev",
  TURNSTILE_SECRET_KEY: "turnstile_test_secret"
};

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    submissionId,
    turnstileToken: "valid-turnstile-token",
    ...overrides
  };
}

function requestFor(
  payload: unknown,
  init: { method?: string; origin?: string; headers?: HeadersInit } = {}
): Request {
  return new Request("https://nicolasmgioanni.dev/api/contact/verify", {
    method: init.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: init.origin ?? "https://nicolasmgioanni.dev",
      ...init.headers
    },
    body: init.method === "GET" ? undefined : JSON.stringify(payload)
  });
}

async function invoke(request: Request, environment: ContactEnv = env) {
  return onRequest({ request, env: environment });
}

function successfulTurnstile(
  hostname = "nicolasmgioanni.dev",
  action = CONTACT_ACTION,
  cdata = submissionId
): Response {
  return Response.json({ success: true, hostname, action, cdata });
}

function decodeTicketPayload(setCookie: string): Record<string, unknown> {
  const cookiePair = setCookie.split(";", 1)[0] ?? "";
  const ticket = cookiePair.slice(cookiePair.indexOf("=") + 1);
  const payloadSegment = ticket.split(".", 1)[0] ?? "";
  const padded = payloadSegment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Cloudflare contact verification function", () => {
  it("allows POST only and returns non-cacheable generic responses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(undefined, { method: "GET" }));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.json()).toEqual({ ok: false, error: "method_not_allowed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin, non-JSON, malformed, oversized, and non-exact bodies before Siteverify", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const crossOrigin = await invoke(requestFor(validPayload(), { origin: "https://attacker.example" }));
    expect(crossOrigin.status).toBe(403);

    const nonJson = await invoke(
      new Request("https://nicolasmgioanni.dev/api/contact/verify", {
        method: "POST",
        headers: { "Content-Type": "text/plain", Origin: "https://nicolasmgioanni.dev" },
        body: "not json"
      })
    );
    expect(nonJson.status).toBe(415);

    const malformed = await invoke(
      new Request("https://nicolasmgioanni.dev/api/contact/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://nicolasmgioanni.dev" },
        body: "{"
      })
    );
    expect(malformed.status).toBe(400);

    const oversized = await invoke(
      new Request("https://nicolasmgioanni.dev/api/contact/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://nicolasmgioanni.dev" },
        body: JSON.stringify({ padding: "x".repeat(MAX_REQUEST_BYTES) })
      })
    );
    expect(oversized.status).toBe(413);

    for (const payload of [
      undefined,
      [],
      {},
      { submissionId },
      { turnstileToken: "token" },
      validPayload({ unexpected: true }),
      validPayload({ submissionId: "not-a-uuid" }),
      validPayload({ turnstileToken: "" }),
      validPayload({ turnstileToken: "x".repeat(2_049) }),
      validPayload({ turnstileToken: "unsafe\u0001token" })
    ]) {
      const response = await invoke(requestFor(payload));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ ok: false, error: "invalid_request" });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["Turnstile secret", { TURNSTILE_SECRET_KEY: "" }],
    ["Turnstile hostname allowlist", { TURNSTILE_ALLOWED_HOSTNAMES: "valid.example,not valid" }],
    ["origin allowlist", { CONTACT_ALLOWED_ORIGINS: "" }]
  ])("fails closed when %s configuration is missing or invalid", async (_label, override) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()), { ...env, ...override });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "service_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid token", { success: false, "error-codes": ["invalid-input-response"] }],
    ["duplicate token", { success: false, "error-codes": ["timeout-or-duplicate"] }],
    ["wrong action", { success: true, hostname: "nicolasmgioanni.dev", action: "other_action", cdata: submissionId }],
    ["wrong hostname", { success: true, hostname: "attacker.example", action: CONTACT_ACTION, cdata: submissionId }],
    ["missing custom data", { success: true, hostname: "nicolasmgioanni.dev", action: CONTACT_ACTION }],
    ["mismatched custom data", { success: true, hostname: "nicolasmgioanni.dev", action: CONTACT_ACTION, cdata: "other-id" }]
  ])("rejects %s Turnstile validation without issuing a ticket", async (_label, turnstileResult) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(turnstileResult));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "verification_failed" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });

  it.each([
    ["network failure", () => Promise.reject(new Error("network unavailable"))],
    ["HTTP 408", () => Promise.resolve(new Response(null, { status: 408 }))],
    ["HTTP 429", () => Promise.resolve(new Response(null, { status: 429 }))],
    ["HTTP 500", () => Promise.resolve(new Response(null, { status: 500 }))],
    [
      "malformed 2xx response",
      () => Promise.resolve(new Response("{", { status: 200, headers: { "Content-Type": "application/json" } }))
    ],
    [
      "provider internal error",
      () => Promise.resolve(Response.json({ success: false, "error-codes": ["internal-error"] }))
    ]
  ])("retries one %s with the identical operation-scoped request", async (_label, firstAttempt) => {
    const fetchMock = vi.fn().mockImplementationOnce(firstAttempt).mockResolvedValueOnce(successfulTurnstile());
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(
      requestFor(validPayload(), { headers: { "CF-Connecting-IP": "203.0.113.10" } })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(firstInit.body).toBe(secondInit.body);
    const firstBody = JSON.parse(String(firstInit.body)) as Record<string, unknown>;
    const secondBody = JSON.parse(String(secondInit.body)) as Record<string, unknown>;
    expect(firstBody).toEqual(secondBody);
    expect(firstBody.idempotency_key).toMatch(uuidPattern);
    expect(firstBody.idempotency_key).not.toBe(submissionId);
    expect(firstBody).toMatchObject({
      secret: "turnstile_test_secret",
      response: "valid-turnstile-token",
      remoteip: "203.0.113.10"
    });
  });

  it("returns verification_unavailable after both transient attempts fail", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(Response.json({ success: false, "error-codes": ["internal-error"] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "verification_unavailable" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(secondBody).toEqual(firstBody);
  });

  it("returns verification_unavailable after two Siteverify timeouts", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = invoke(requestFor(validPayload()));
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "verification_unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("disposes a late Siteverify response when a noncooperative fetch ignores abort", async () => {
    vi.useFakeTimers();
    let cancellationCount = 0;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(() => resolve(stalledJsonResponse(() => {
              cancellationCount += 1;
            })), 6_000);
          })
      )
      .mockResolvedValueOnce(successfulTurnstile());
    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = invoke(requestFor(validPayload()));
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await responsePromise;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cancellationCount).toBe(1);
  });

  it("bounds each stalled Siteverify JSON body and preserves the retry budget", async () => {
    vi.useFakeTimers();
    let cancellationCount = 0;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(stalledJsonResponse(() => {
        cancellationCount += 1;
      }))
      .mockResolvedValueOnce(stalledJsonResponse(() => {
        cancellationCount += 1;
      }));
    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = invoke(requestFor(validPayload()));
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "verification_unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cancellationCount).toBe(2);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).redirect).toBe("manual");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).redirect).toBe("manual");
  });

  it("rejects oversized Siteverify JSON bodies without waiting for stream cancellation", async () => {
    let cancellationCount = 0;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(oversizedJsonResponse(() => {
        cancellationCount += 1;
      }))
      .mockResolvedValueOnce(oversizedJsonResponse(() => {
        cancellationCount += 1;
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "verification_unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cancellationCount).toBe(2);
  });

  it("returns from an oversized inbound body without awaiting a stalled cancellation", async () => {
    let cancellationCount = 0;
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(new Uint8Array(MAX_REQUEST_BYTES + 1)),
      cancel: () => {
        cancellationCount += 1;
        return new Promise<void>(() => undefined);
      }
    });
    const request = new Request("https://nicolasmgioanni.dev/api/contact/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://nicolasmgioanni.dev" },
      body,
      duplex: "half"
    } as RequestInit);

    await expect(readJsonBody(request)).resolves.toEqual({ kind: "too-large" });
    expect(cancellationCount).toBe(1);
  });

  it("bounds a stalled inbound request body and retains its invalid-request outcome", async () => {
    vi.useFakeTimers();
    let cancellationCount = 0;
    const body = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
      cancel: () => {
        cancellationCount += 1;
        return new Promise<void>(() => undefined);
      }
    });
    const request = new Request("https://nicolasmgioanni.dev/api/contact/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://nicolasmgioanni.dev" },
      body,
      duplex: "half"
    } as RequestInit);

    const read = readJsonBody(request);
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(read).resolves.toEqual({ kind: "invalid" });
    expect(cancellationCount).toBe(1);
  });

  it("does not retry a non-transient Siteverify HTTP failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "verification_unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["missing-input-secret", "invalid-input-secret", "missing-input-response", "bad-request", "unknown-error"])(
    "returns verification_unavailable for the provider error %s without retrying",
    async (errorCode) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ success: false, "error-codes": [errorCode] }));
      vi.stubGlobal("fetch", fetchMock);

      const response = await invoke(requestFor(validPayload()));

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false, error: "verification_unavailable" });
      expect(response.headers.get("Set-Cookie")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("returns verification_unavailable for an empty provider error list", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ success: false, "error-codes": [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "verification_unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses a new operation id for each independent verification request", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(successfulTurnstile()));
    vi.stubGlobal("fetch", fetchMock);

    expect((await invoke(requestFor(validPayload()))).status).toBe(200);
    expect((await invoke(requestFor(validPayload()))).status).toBe(200);

    const operationIds = fetchMock.mock.calls.map(([, init]) => {
      return JSON.parse(String((init as RequestInit).body)).idempotency_key as string;
    });
    expect(operationIds).toHaveLength(2);
    expect(operationIds[0]).toMatch(uuidPattern);
    expect(operationIds[1]).toMatch(uuidPattern);
    expect(operationIds[0]).not.toBe(operationIds[1]);
  });

  it("verifies action, hostname, custom data, and remote IP before issuing the strict signed cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(successfulTurnstile("NICOLASMGIOANNI.DEV"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(
      requestFor(validPayload(), { headers: { "CF-Connecting-IP": "203.0.113.10" } })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const verifyInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(verifyInit.headers).get("Content-Type")).toBe("application/json");
    const verifyBody = JSON.parse(String(verifyInit.body)) as Record<string, unknown>;
    expect(verifyBody).toMatchObject({
      secret: "turnstile_test_secret",
      response: "valid-turnstile-token",
      remoteip: "203.0.113.10"
    });
    expect(verifyBody.idempotency_key).toMatch(uuidPattern);
    expect(verifyBody.idempotency_key).not.toBe(submissionId);

    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(
      new RegExp(`^${CONTACT_TICKET_COOKIE_NAME}=[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+; Path=/; Max-Age=1800; Secure; HttpOnly; SameSite=Strict$`)
    );
    expect(setCookie).not.toContain("Domain=");
    const ticketPayload = decodeTicketPayload(setCookie ?? "");
    expect(Object.keys(ticketPayload)).toEqual(["v", "submissionId", "iat", "exp"]);
    expect(ticketPayload).toMatchObject({ v: 1, submissionId });
    expect(Number(ticketPayload.exp) - Number(ticketPayload.iat)).toBe(CONTACT_TICKET_MAX_AGE_SECONDS);

    const cookiePair = setCookie?.split(";", 1)[0] ?? "";
    const ticketRequest = new Request("https://nicolasmgioanni.dev/api/contact", {
      headers: { Cookie: cookiePair }
    });
    expect(await hasValidContactTicket(ticketRequest, submissionId, env)).toBe(true);
  });

  it("needs only Turnstile configuration and does not depend on Resend delivery secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(successfulTurnstile());
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()), {
      ...env,
      CONTACT_FROM_EMAIL: "",
      CONTACT_RECIPIENT_EMAIL: "",
      CONTACT_REPLY_TO_EMAIL: "",
      RESEND_API_KEY: ""
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain(`${CONTACT_TICKET_COOKIE_NAME}=`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
