import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTACT_ACTION, MAX_REQUEST_BYTES } from "../_shared/contact";
import { onRequest } from "./contact";

const privateRecipient = "private-owner@example.net";
const configuredFromEmail = "Portfolio Contact <contact@example.com>";
const configuredReplyToEmail = "reply@example.com";
const submissionId = "4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9";

const env = {
  CONTACT_ALLOWED_ORIGINS: "https://nicolasmgioanni.dev",
  CONTACT_FROM_EMAIL: configuredFromEmail,
  CONTACT_RECIPIENT_EMAIL: privateRecipient,
  CONTACT_REPLY_TO_EMAIL: configuredReplyToEmail,
  RESEND_API_KEY: "re_test_secret",
  TURNSTILE_ALLOWED_HOSTNAMES: "nicolasmgioanni.dev,www.nicolasmgioanni.dev",
  TURNSTILE_SECRET_KEY: "turnstile_test_secret"
};

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    submissionId,
    firstName: "Avery",
    lastName: "Nguyen",
    email: "avery@example.com",
    phone: "+44 20 7946 0958",
    message: "I would like to discuss a professional opportunity.",
    contactConsent: true,
    legalConsent: true,
    legitimateConsent: true,
    turnstileToken: "valid-turnstile-token",
    startedAt: Date.now() - 5_000,
    website: "",
    ...overrides
  };
}

function requestFor(payload: unknown, init: { method?: string; origin?: string; headers?: HeadersInit } = {}): Request {
  return new Request("https://nicolasmgioanni.dev/api/contact", {
    method: init.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: init.origin ?? "https://nicolasmgioanni.dev",
      ...init.headers
    },
    body: init.method === "GET" ? undefined : JSON.stringify(payload)
  });
}

async function invoke(request: Request, environment = env) {
  return onRequest({ request, env: environment });
}

function successfulTurnstile(hostname = "nicolasmgioanni.dev", action = CONTACT_ACTION): Response {
  return Response.json({ success: true, hostname, action });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Cloudflare contact function", () => {
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

  it("rejects cross-origin, non-JSON, malformed, oversized, and invalid submissions before external calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const crossOrigin = await invoke(requestFor(validPayload(), { origin: "https://attacker.example" }));
    expect(crossOrigin.status).toBe(403);

    const nonJson = await invoke(
      new Request("https://nicolasmgioanni.dev/api/contact", {
        method: "POST",
        headers: { "Content-Type": "text/plain", Origin: "https://nicolasmgioanni.dev" },
        body: "not json"
      })
    );
    expect(nonJson.status).toBe(415);

    const malformed = await invoke(
      new Request("https://nicolasmgioanni.dev/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://nicolasmgioanni.dev" },
        body: "{"
      })
    );
    expect(malformed.status).toBe(400);

    const oversized = await invoke(requestFor(validPayload({ message: "x".repeat(MAX_REQUEST_BYTES) })));
    expect(oversized.status).toBe(413);

    for (const overrides of [
      { firstName: "" },
      { lastName: "" },
      { email: "invalid" },
      { phone: 4255550123 },
      { message: "" },
      { contactConsent: false },
      { legalConsent: false },
      { legitimateConsent: false },
      { turnstileToken: "" },
      { unexpected: "field" }
    ]) {
      const response = await invoke(requestFor(validPayload(overrides)));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ ok: false, error: "invalid_request" });
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a malformed origin allowlist as unavailable configuration", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()), { ...env, CONTACT_ALLOWED_ORIGINS: "not-an-origin" });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "service_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("silently accepts honeypot and implausibly fast submissions without verification or email", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const honeypot = await invoke(requestFor(validPayload({ website: "https://spam.example" })));
    const tooFast = await invoke(requestFor(validPayload({ startedAt: Date.now() })));

    expect(honeypot.status).toBe(200);
    expect(tooFast.status).toBe(200);
    expect(await honeypot.json()).toEqual({ ok: true });
    expect(await tooFast.json()).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["Turnstile secret", { TURNSTILE_SECRET_KEY: "" }],
    ["Turnstile hostname allowlist", { TURNSTILE_ALLOWED_HOSTNAMES: "valid.example,not valid" }],
    ["origin allowlist", { CONTACT_ALLOWED_ORIGINS: "" }],
    ["Resend key", { RESEND_API_KEY: "" }],
    ["recipient", { CONTACT_RECIPIENT_EMAIL: "not-an-email" }],
    ["sender", { CONTACT_FROM_EMAIL: "Invalid Sender <not-an-email>" }],
    ["fixed reply-to", { CONTACT_REPLY_TO_EMAIL: "not-an-email" }]
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
  ])("rejects %s Turnstile validation without calling Resend", async (_label, turnstileResult) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(turnstileResult));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "verification_failed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });

  it("fails closed when Siteverify is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "verification_failed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("verifies the token and sends one idempotent batch containing the private notice and confirmation", async () => {
    const payload = validPayload({
      firstName: "Avery <script>",
      lastName: "Nguyen & Co.",
      message: "Hello <img src=x onerror=alert(1)>\nSecond line"
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(successfulTurnstile())
      .mockResolvedValueOnce(Response.json({ data: [{ id: "owner-id" }, { id: "confirmation-id" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(
      new Request("https://nicolasmgioanni.dev/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://nicolasmgioanni.dev",
          "CF-Connecting-IP": "203.0.113.10"
        },
        body: JSON.stringify(payload)
      })
    );

    expect(response.status).toBe(200);
    const responseText = await response.text();
    expect(responseText).toBe('{"ok":true}');
    expect(responseText).not.toContain(privateRecipient);
    expect(responseText).not.toContain("re_test_secret");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const turnstileInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(turnstileInit.body))).toEqual({
      secret: "turnstile_test_secret",
      response: "valid-turnstile-token",
      idempotency_key: submissionId,
      remoteip: "203.0.113.10"
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.resend.com/emails/batch");
    const resendInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(resendInit.headers).get("Authorization")).toBe("Bearer re_test_secret");
    expect(new Headers(resendInit.headers).get("Idempotency-Key")).toBe(`portfolio-contact/${submissionId}`);

    const messages = JSON.parse(String(resendInit.body)) as Array<Record<string, unknown>>;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      from: configuredFromEmail,
      to: [privateRecipient],
      reply_to: "avery@example.com",
      subject: "New portfolio contact request"
    });
    expect(messages[1]).toMatchObject({
      from: configuredFromEmail,
      to: ["avery@example.com"],
      reply_to: configuredReplyToEmail,
      subject: "Contact request received"
    });
    expect(messages[1]?.text).toContain(`email ${configuredReplyToEmail}`);
    expect(messages[1]?.html).toContain(`mailto:${configuredReplyToEmail}`);
    for (const message of messages) {
      expect(message.html).toContain("Avery &lt;script&gt;");
      expect(message.html).toContain("&lt;img src=x onerror=alert(1)&gt;<br>Second line");
      expect(message.html).not.toContain("<script>");
      expect(message.html).not.toContain("<img src=x");
    }
  });

  it("uses the same Resend idempotency key when a client safely retries a submission", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(successfulTurnstile())
      .mockResolvedValueOnce(Response.json({ data: [{ id: "one" }, { id: "two" }] }))
      .mockResolvedValueOnce(successfulTurnstile())
      .mockResolvedValueOnce(Response.json({ data: [{ id: "one" }, { id: "two" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await invoke(requestFor(validPayload({ turnstileToken: "first-fresh-token" })));
    const retry = await invoke(requestFor(validPayload({ turnstileToken: "second-fresh-token" })));

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    const firstResendHeaders = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    const retryResendHeaders = new Headers((fetchMock.mock.calls[3]?.[1] as RequestInit).headers);
    expect(firstResendHeaders.get("Idempotency-Key")).toBe(`portfolio-contact/${submissionId}`);
    expect(retryResendHeaders.get("Idempotency-Key")).toBe(firstResendHeaders.get("Idempotency-Key"));
  });

  it("returns a generic delivery failure without disclosing the private recipient", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(successfulTurnstile())
      .mockResolvedValueOnce(Response.json({ message: "provider rejected private-owner@example.net" }, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()));
    const responseText = await response.text();

    expect(response.status).toBe(502);
    expect(responseText).toBe('{"ok":false,"error":"delivery_failed"}');
    expect(responseText).not.toContain(privateRecipient);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
