import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_TICKET_COOKIE_NAME,
  CONTACT_TICKET_MAX_AGE_SECONDS,
  MAX_REQUEST_BYTES,
  createContactTicket
} from "../_shared/contact";
import { onRequest } from "./contact";

const privateRecipient = "private-owner@example.net";
const configuredFromEmail = "Portfolio Contact <contact@example.com>";
const configuredReplyToEmail = "reply@example.com";
const submissionId = "4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9";
const otherSubmissionId = "92d8fa8c-93dd-4b65-821b-33b9867b389f";

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
    startedAt: Date.now() - 5_000,
    website: "",
    ...overrides
  };
}

function requestFor(
  payload: unknown,
  init: { method?: string; origin?: string; headers?: HeadersInit; cookie?: string } = {}
): Request {
  return new Request("https://nicolasmgioanni.dev/api/contact", {
    method: init.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: init.origin ?? "https://nicolasmgioanni.dev",
      ...(init.cookie ? { Cookie: init.cookie } : {}),
      ...init.headers
    },
    body: init.method === "GET" ? undefined : JSON.stringify(payload)
  });
}

async function invoke(request: Request, environment = env) {
  return onRequest({ request, env: environment });
}

async function ticketCookie(
  id = submissionId,
  issuedAt = Date.now(),
  environment: typeof env = env
): Promise<string> {
  const ticket = await createContactTicket(id, environment, issuedAt);
  if (!ticket) throw new Error("Expected a contact ticket in the test setup.");
  return `${CONTACT_TICKET_COOKIE_NAME}=${ticket}`;
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
      { unexpected: "field" },
      { turnstileToken: "tokens-are-not-accepted-by-the-delivery-endpoint" }
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

  it("silently accepts honeypot and implausibly fast submissions without a ticket or external call", async () => {
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
    ["ticket signing secret", { TURNSTILE_SECRET_KEY: "" }],
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

  it("requires a valid ticket bound to the submitted identifier before Resend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const missing = await invoke(requestFor(validPayload()));
    const malformed = await invoke(requestFor(validPayload(), { cookie: `${CONTACT_TICKET_COOKIE_NAME}=not-a-ticket` }));
    const wrongSubmission = await invoke(
      requestFor(validPayload({ submissionId: otherSubmissionId }), { cookie: await ticketCookie() })
    );

    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(wrongSubmission.status).toBe(401);
    for (const response of [missing, malformed, wrongSubmission]) {
      expect(await response.json()).toEqual({ ok: false, error: "verification_required" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects tampered, expired, future-issued, and duplicate tickets before Resend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const signedCookie = await ticketCookie();
    const signedTicket = signedCookie.slice(signedCookie.indexOf("=") + 1);
    const [payloadSegment, signatureSegment = ""] = signedTicket.split(".");
    const tamperedSignature = `${signatureSegment[0] === "A" ? "B" : "A"}${signatureSegment.slice(1)}`;
    const tamperedCookie = `${CONTACT_TICKET_COOKIE_NAME}=${payloadSegment}.${tamperedSignature}`;
    const expiredCookie = await ticketCookie(
      submissionId,
      Date.now() - (CONTACT_TICKET_MAX_AGE_SECONDS + 1) * 1_000
    );
    const futureCookie = await ticketCookie(submissionId, Date.now() + 31_000);
    const duplicateCookie = `${signedCookie}; ${signedCookie}`;

    for (const cookie of [tamperedCookie, expiredCookie, futureCookie, duplicateCookie]) {
      const response = await invoke(requestFor(validPayload(), { cookie }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ ok: false, error: "verification_required" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one idempotent Resend batch without calling Siteverify and clears the ticket after success", async () => {
    const payload = validPayload({
      firstName: "Avery <script>",
      lastName: "Nguyen & Co.",
      message: "Hello <img src=x onerror=alert(1)>\nSecond line"
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ data: [{ id: "owner-id" }, { id: "confirmation-id" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(
      new Request("https://nicolasmgioanni.dev/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://nicolasmgioanni.dev",
          Cookie: await ticketCookie(),
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
    expect(response.headers.get("Set-Cookie")).toBe(
      `${CONTACT_TICKET_COOKIE_NAME}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.resend.com/emails/batch");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("siteverify"))).toBe(false);
    const resendInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
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

  it("retains the ticket after delivery failure and reuses the Resend idempotency key on retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ message: "temporary failure" }, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: "one" }, { id: "two" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const cookie = await ticketCookie();
    const first = await invoke(requestFor(validPayload(), { cookie }));
    const retry = await invoke(requestFor(validPayload(), { cookie }));

    expect(first.status).toBe(502);
    expect(await first.text()).toBe('{"ok":false,"error":"delivery_failed"}');
    expect(first.headers.get("Set-Cookie")).toBeNull();
    expect(retry.status).toBe(200);
    expect(retry.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    const retryHeaders = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(firstHeaders.get("Idempotency-Key")).toBe(`portfolio-contact/${submissionId}`);
    expect(retryHeaders.get("Idempotency-Key")).toBe(firstHeaders.get("Idempotency-Key"));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("siteverify"))).toBe(false);
  });

  it("does not require the Siteverify hostname allowlist after a ticket has been issued", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ data: [{ id: "one" }, { id: "two" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload(), { cookie: await ticketCookie() }), {
      ...env,
      TURNSTILE_ALLOWED_HOSTNAMES: ""
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.resend.com/emails/batch");
  });
});
