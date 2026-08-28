import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_ACTION,
  CONTACT_TICKET_COOKIE_NAME,
  CONTACT_TICKET_MAX_AGE_SECONDS,
  MAX_REQUEST_BYTES,
  hasValidContactTicket,
  type ContactEnv
} from "../../_shared/contact";
import { onRequest } from "./verify";

const submissionId = "4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9";
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

function successfulTurnstile(hostname = "nicolasmgioanni.dev", action = CONTACT_ACTION): Response {
  return Response.json({ success: true, hostname, action });
}

function decodeTicketPayload(setCookie: string): Record<string, unknown> {
  const cookiePair = setCookie.split(";", 1)[0] ?? "";
  const ticket = cookiePair.slice(cookiePair.indexOf("=") + 1);
  const payloadSegment = ticket.split(".", 1)[0] ?? "";
  const padded = payloadSegment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

afterEach(() => {
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
    ["unsuccessful", { success: false, hostname: "nicolasmgioanni.dev", action: CONTACT_ACTION }],
    ["wrong action", { success: true, hostname: "nicolasmgioanni.dev", action: "other_action" }],
    ["wrong hostname", { success: true, hostname: "attacker.example", action: CONTACT_ACTION }]
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

  it("fails closed when Siteverify is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "verification_failed" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("verifies action, hostname, and remote IP once before issuing the strict signed cookie", async () => {
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
    expect(JSON.parse(String(verifyInit.body))).toEqual({
      secret: "turnstile_test_secret",
      response: "valid-turnstile-token",
      idempotency_key: submissionId,
      remoteip: "203.0.113.10"
    });

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
