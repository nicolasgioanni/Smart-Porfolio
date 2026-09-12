import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT_RATE_LIMIT_MAX_SUBMISSIONS,
  CONTACT_RATE_LIMIT_WINDOW_SECONDS,
  CONTACT_TICKET_COOKIE_NAME,
  CONTACT_TICKET_MAX_AGE_SECONDS,
  MAX_REQUEST_BYTES,
  createContactTicket,
  createEmailMessages,
  parseContactPayload,
  reserveContactSubmission,
  validateEmailDomain,
  type ContactEnv,
  type ContactPayload,
  type ContactRateLimitDatabase,
  type ContactRateLimitPreparedStatement,
  type ContactRateLimitResult
} from "../_shared/contact";
import { oversizedJsonResponse, stalledJsonResponse } from "../testSupport/streams";
import { onRequest } from "./contact";

const privateRecipient = "private-owner@example.net";
const configuredFromEmail = "Nicolas Gioanni <noreply@mail.nicolasmgioanni.dev>";
const configuredReplyToEmail = "ngioanni@uw.edu";
const submissionId = "4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9";
const otherSubmissionId = "92d8fa8c-93dd-4b65-821b-33b9867b389f";
const thirdSubmissionId = "76c85491-ff24-44c6-ab99-8e553ec02c6a";
const validStartedAt = Date.now() - 5_000;

interface ReservationRow {
  submission_id: string;
  email_hash: string;
  payload_hash: string | null;
  reserved_at: number;
  expires_at: number;
}

class FakeStatement implements ContactRateLimitPreparedStatement {
  constructor(
    readonly query: string,
    readonly values: unknown[] = []
  ) {}

  bind(...values: unknown[]): ContactRateLimitPreparedStatement {
    return new FakeStatement(this.query, values);
  }
}

class FakeContactDatabase implements ContactRateLimitDatabase {
  readonly rows = new Map<string, ReservationRow>();
  fail = false;
  private queue: Promise<void> = Promise.resolve();

  prepare(query: string): ContactRateLimitPreparedStatement {
    return new FakeStatement(query);
  }

  batch<T = Record<string, unknown>>(
    statements: ContactRateLimitPreparedStatement[]
  ): Promise<Array<ContactRateLimitResult<T>>> {
    let resolveResult!: (value: Array<ContactRateLimitResult<T>>) => void;
    let rejectResult!: (reason?: unknown) => void;
    const result = new Promise<Array<ContactRateLimitResult<T>>>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    this.queue = this.queue.catch(() => undefined).then(() => {
      if (this.fail) throw new Error("D1 unavailable");
      const snapshot = new Map([...this.rows].map(([key, value]) => [key, { ...value }]));
      const results: Array<ContactRateLimitResult<Record<string, unknown>>> = [];
      try {
        for (const statement of statements) results.push(this.execute(statement as FakeStatement));
      } catch (error) {
        this.rows.clear();
        for (const [key, value] of snapshot) this.rows.set(key, value);
        throw error;
      }
      resolveResult(results as Array<ContactRateLimitResult<T>>);
    });
    this.queue.catch(rejectResult);
    return result;
  }

  private execute(statement: FakeStatement): ContactRateLimitResult<Record<string, unknown>> {
    const query = statement.query.trim();
    if (query.startsWith("DELETE FROM contact_rate_reservations")) {
      const [now] = statement.values as [number];
      for (const [id, row] of this.rows) if (row.expires_at <= now) this.rows.delete(id);
      return { success: true, results: [] };
    }

    if (query.startsWith("INSERT INTO contact_rate_reservations")) {
      const [id, emailHash, payloadHash, reservedAt, expiresAt] = statement.values as [
        string,
        string,
        string,
        number,
        number
      ];
      const existing = this.rows.get(id);
      const activeCount = [...this.rows.values()].filter(
        (row) => row.email_hash === emailHash && row.expires_at > reservedAt
      ).length;
      if (!existing && activeCount < CONTACT_RATE_LIMIT_MAX_SUBMISSIONS) {
        this.rows.set(id, {
          submission_id: id,
          email_hash: emailHash,
          payload_hash: payloadHash,
          reserved_at: reservedAt,
          expires_at: expiresAt
        });
      }
      return { success: true, results: [] };
    }

    if (query.startsWith("SELECT email_hash")) {
      const [id] = statement.values as [string];
      const row = this.rows.get(id);
      return { success: true, results: row ? [{ ...row }] : [] };
    }

    if (query.startsWith("SELECT COUNT(*) AS reservation_count")) {
      const [emailHash, now] = statement.values as [string, number];
      const active = [...this.rows.values()].filter(
        (row) => row.email_hash === emailHash && row.expires_at > now
      );
      return {
        success: true,
        results: [
          {
            reservation_count: active.length,
            next_expiry: active.length ? Math.min(...active.map((row) => row.expires_at)) : null
          }
        ]
      };
    }

    throw new Error(`Unexpected query: ${query}`);
  }
}

let rateLimitDatabase: FakeContactDatabase;
let env: ContactEnv;

beforeEach(() => {
  rateLimitDatabase = new FakeContactDatabase();
  env = {
    CONTACT_ALLOWED_ORIGINS: "https://nicolasmgioanni.dev",
    CONTACT_FROM_EMAIL: configuredFromEmail,
    CONTACT_RECIPIENT_EMAIL: privateRecipient,
    CONTACT_REPLY_TO_EMAIL: configuredReplyToEmail,
    RESEND_API_KEY: "re_test_secret",
    TURNSTILE_ALLOWED_HOSTNAMES: "nicolasmgioanni.dev,www.nicolasmgioanni.dev",
    TURNSTILE_SECRET_KEY: "turnstile_test_secret",
    CONTACT_RATE_LIMIT_DB: rateLimitDatabase
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function validPayload(overrides: Record<string, unknown> = {}): ContactPayload {
  return {
    submissionId,
    firstName: "Avery",
    lastName: "Nguyen",
    email: "avery@example.com",
    phone: "+44 20 7946 0958",
    message: "I would like to discuss a professional opportunity.",
    contactConsent: true,
    legalConsent: true,
    startedAt: validStartedAt,
    website: "",
    ...overrides
  } as ContactPayload;
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

async function invoke(request: Request, environment: ContactEnv = env) {
  return onRequest({ request, env: environment });
}

async function ticketCookie(id = submissionId, issuedAt = Date.now(), environment: ContactEnv = env): Promise<string> {
  const ticket = await createContactTicket(id, environment, issuedAt);
  if (!ticket) throw new Error("Expected a contact ticket in the test setup.");
  return `${CONTACT_TICKET_COOKIE_NAME}=${ticket}`;
}

function mxResponse(exchange = "10 mx.example.com."): Response {
  return Response.json({ Status: 0, Answer: [{ type: 15, data: exchange }] });
}

function resendAccepted(id: string): Response {
  return Response.json({ id });
}

describe("contact payload validation", () => {
  it("accepts exactly 500 message characters and rejects 501", () => {
    const now = validStartedAt + 5_000;
    const accepted = parseContactPayload(validPayload({ message: "x".repeat(500) }), now);
    const rejected = parseContactPayload(validPayload({ message: "x".repeat(501) }), now);

    expect(accepted).toMatchObject({ kind: "valid", payload: { message: "x".repeat(500) } });
    expect(rejected).toEqual({ kind: "invalid" });
  });

  it("distinguishes an expired two-hour draft from malformed timing data", () => {
    const now = validStartedAt + 2 * 60 * 60 * 1_000 + 1;

    expect(parseContactPayload(validPayload(), now)).toEqual({ kind: "expired" });
    expect(parseContactPayload(validPayload({ email: "invalid" }), now)).toEqual({ kind: "invalid" });
    expect(parseContactPayload(validPayload({ startedAt: now + 31_000 }), now)).toEqual({ kind: "invalid" });
  });

  it.each([
    "person@example.co",
    "PERSON@EXAMPLE.COM",
    "person@sub.example.co.uk",
    "person@example.xn--p1ai"
  ])("accepts a deliverable-looking domain suffix in %s", (email) => {
    expect(parseContactPayload(validPayload({ email }), validStartedAt + 5_000).kind).toBe("valid");
  });

  it.each([
    "person@example",
    "person@example.",
    "person@example.c",
    "person@example.123",
    "person@example.c0",
    "person@example.xn--abc",
    "person@192.0.2.1",
    "person@example..com",
    "person@-example.com",
    "person@example-.com"
  ])("rejects an invalid or missing domain suffix in %s", (email) => {
    expect(parseContactPayload(validPayload({ email }), validStartedAt + 5_000)).toEqual({ kind: "invalid" });
  });

  it("requires both canonical consent flags as literal true and rejects the retired field", () => {
    for (const overrides of [
      { contactConsent: false },
      { contactConsent: "true" },
      { contactConsent: undefined },
      { legalConsent: false },
      { legalConsent: "true" },
      { legalConsent: undefined },
      { legitimateConsent: true }
    ]) {
      expect(parseContactPayload(validPayload(overrides), validStartedAt + 5_000)).toEqual({ kind: "invalid" });
    }
  });
});

describe("Cloudflare contact function security boundary", () => {
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

    expect((await invoke(requestFor(validPayload(), { origin: "https://attacker.example" }))).status).toBe(403);
    expect(
      (
        await invoke(
          new Request("https://nicolasmgioanni.dev/api/contact", {
            method: "POST",
            headers: { "Content-Type": "text/plain", Origin: "https://nicolasmgioanni.dev" },
            body: "not json"
          })
        )
      ).status
    ).toBe(415);
    expect(
      (
        await invoke(
          new Request("https://nicolasmgioanni.dev/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: "https://nicolasmgioanni.dev" },
            body: "{"
          })
        )
      ).status
    ).toBe(400);
    expect((await invoke(requestFor(validPayload({ message: "x".repeat(MAX_REQUEST_BYTES) })))).status).toBe(413);

    for (const overrides of [
      { firstName: "" },
      { firstName: "header\r\ninjection" },
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
    expect(rateLimitDatabase.rows).toHaveLength(0);
  });

  it("silently accepts honeypot and implausibly fast submissions without a ticket, DNS, or quota", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const honeypot = await invoke(requestFor(validPayload({ website: "https://spam.example" })));
    const tooFast = await invoke(requestFor(validPayload({ startedAt: Date.now() })));

    expect(await honeypot.json()).toEqual({ ok: true });
    expect(await tooFast.json()).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rateLimitDatabase.rows).toHaveLength(0);
  });

  it("returns a distinct recovery response for a draft older than two hours", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(
      requestFor(validPayload({ startedAt: Date.now() - 2 * 60 * 60 * 1_000 - 1 }))
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: "request_expired" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rateLimitDatabase.rows).toHaveLength(0);
  });

  it.each([
    ["ticket signing secret", { TURNSTILE_SECRET_KEY: "" }],
    ["origin allowlist", { CONTACT_ALLOWED_ORIGINS: "" }],
    ["Resend key", { RESEND_API_KEY: "" }],
    ["recipient", { CONTACT_RECIPIENT_EMAIL: "not-an-email" }],
    ["sender", { CONTACT_FROM_EMAIL: "Invalid Sender <not-an-email>" }],
    ["fixed reply-to", { CONTACT_REPLY_TO_EMAIL: "not-an-email" }],
    ["D1 binding", { CONTACT_RATE_LIMIT_DB: undefined }]
  ])("fails closed when %s configuration is missing or invalid", async (_label, override) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload()), { ...env, ...override });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "service_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a valid ticket bound to the submitted identifier before DNS and D1", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const missing = await invoke(requestFor(validPayload()));
    const malformed = await invoke(
      requestFor(validPayload(), { cookie: `${CONTACT_TICKET_COOKIE_NAME}=not-a-ticket` })
    );
    const wrongSubmission = await invoke(
      requestFor(validPayload({ submissionId: otherSubmissionId }), { cookie: await ticketCookie() })
    );

    for (const response of [missing, malformed, wrongSubmission]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ ok: false, error: "verification_required" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rateLimitDatabase.rows).toHaveLength(0);
  });

  it("rejects tampered, expired, future-issued, and duplicate tickets before DNS", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const signedCookie = await ticketCookie();
    const signedTicket = signedCookie.slice(signedCookie.indexOf("=") + 1);
    const [payloadSegment, signatureSegment = ""] = signedTicket.split(".");
    const tamperedSignature = `${signatureSegment[0] === "A" ? "B" : "A"}${signatureSegment.slice(1)}`;
    const expiredCookie = await ticketCookie(
      submissionId,
      Date.now() - (CONTACT_TICKET_MAX_AGE_SECONDS + 1) * 1_000
    );
    const futureCookie = await ticketCookie(submissionId, Date.now() + 60_000);
    const cookies = [
      `${CONTACT_TICKET_COOKIE_NAME}=${payloadSegment}.${tamperedSignature}`,
      expiredCookie,
      futureCookie,
      `${signedCookie}; ${signedCookie}`
    ];

    for (const cookie of cookies) {
      const response = await invoke(requestFor(validPayload(), { cookie }));
      expect(response.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("email-domain validation", () => {
  it("accepts a non-null MX without requesting fallback records", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mxResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateEmailDomain("Avery@Example.co")).resolves.toEqual({ kind: "valid" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("name=example.co&type=MX");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).redirect).toBe("error");
  });

  it("does not wait for cancellation when a DNS JSON body exceeds its cap", async () => {
    let cancellationCount = 0;
    const fetchMock = vi.fn().mockResolvedValueOnce(oversizedJsonResponse(() => {
      cancellationCount += 1;
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateEmailDomain("avery@example.com")).resolves.toEqual({ kind: "unavailable" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancellationCount).toBe(1);
  });

  it("bounds a stalled DNS JSON body by the same resolver deadline", async () => {
    vi.useFakeTimers();
    let cancellationCount = 0;
    const fetchMock = vi.fn().mockResolvedValueOnce(stalledJsonResponse(() => {
      cancellationCount += 1;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const validation = validateEmailDomain("avery@example.com");
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(validation).resolves.toEqual({ kind: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancellationCount).toBe(1);
  });

  it("rejects null MX and NXDOMAIN results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mxResponse("0 ."))
      .mockResolvedValueOnce(Response.json({ Status: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateEmailDomain("first@example.com")).resolves.toEqual({ kind: "invalid" });
    await expect(validateEmailDomain("second@example.net")).resolves.toEqual({ kind: "invalid" });
  });

  it("falls back to A and AAAA concurrently when MX is absent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ Status: 0 }))
      .mockResolvedValueOnce(Response.json({ Status: 0, Answer: [{ type: 1, data: "192.0.2.1" }] }))
      .mockResolvedValueOnce(Response.json({ Status: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateEmailDomain("avery@example.com")).resolves.toEqual({ kind: "valid" });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("type=MX"),
      expect.stringContaining("type=A"),
      expect.stringContaining("type=AAAA")
    ]);
  });

  it("treats a truncated DNS response as unavailable without using partial answers", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        Status: 0,
        TC: true,
        Answer: [{ type: 15, data: "10 mx.example.com." }]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateEmailDomain("avery@example.com")).resolves.toEqual({ kind: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats any malformed answer entry as unavailable instead of using valid sibling or fallback records", async () => {
    const malformedMxFetch = vi.fn().mockResolvedValueOnce(
      Response.json({
        Status: 0,
        Answer: [
          { type: 15, data: "10 mx.example.com." },
          { type: "15", data: "20 backup.example.com." }
        ]
      })
    );
    vi.stubGlobal("fetch", malformedMxFetch);
    await expect(validateEmailDomain("avery@example.com")).resolves.toEqual({ kind: "unavailable" });
    expect(malformedMxFetch).toHaveBeenCalledTimes(1);

    const malformedFallbackFetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ Status: 0 }))
      .mockResolvedValueOnce(Response.json({ Status: 0, Answer: [{ type: 1 }] }))
      .mockResolvedValueOnce(Response.json({ Status: 0 }));
    vi.stubGlobal("fetch", malformedFallbackFetch);
    await expect(validateEmailDomain("avery@example.com")).resolves.toEqual({ kind: "unavailable" });
    expect(malformedFallbackFetch).toHaveBeenCalledTimes(3);
  });

  it("distinguishes a resolver outage from an unroutable domain", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })));
    await expect(validateEmailDomain("avery@example.com")).resolves.toEqual({ kind: "unavailable" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ Status: 0 }))
        .mockResolvedValueOnce(Response.json({ Status: 0 }))
        .mockResolvedValueOnce(Response.json({ Status: 0 }))
    );
    await expect(validateEmailDomain("avery@example.com")).resolves.toEqual({ kind: "invalid" });
  });
});

describe("pseudonymous rolling quota", () => {
  it("allows exactly two active IDs, normalizes email case/whitespace, and returns the earliest retry time", async () => {
    const now = Date.UTC(2026, 7, 30, 12, 0, 0);
    const first = await reserveContactSubmission(
      validPayload({ submissionId, email: " Avery@Example.com " }),
      env,
      now
    );
    const second = await reserveContactSubmission(
      validPayload({ submissionId: otherSubmissionId, email: "avery@example.com" }),
      env,
      now + 1_000
    );
    const third = await reserveContactSubmission(
      validPayload({ submissionId: thirdSubmissionId, email: "AVERY@example.com" }),
      env,
      now + 2_000
    );

    expect(first).toEqual({ kind: "reserved", reservedAt: Math.floor(now / 1_000) });
    expect(second.kind).toBe("reserved");
    expect(third).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: CONTACT_RATE_LIMIT_WINDOW_SECONDS - 2
    });
    expect(rateLimitDatabase.rows).toHaveLength(2);
    for (const row of rateLimitDatabase.rows.values()) {
      expect(row.email_hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(row.payload_hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(JSON.stringify(row)).not.toContain("avery@example.com");
      expect(JSON.stringify(row)).not.toContain("professional opportunity");
    }
  });

  it("treats a same-ID identical-payload retry as free and rejects a changed email", async () => {
    const now = Date.UTC(2026, 7, 30, 12, 0, 0);
    const payload = validPayload();
    const first = await reserveContactSubmission(payload, env, now);
    const retry = await reserveContactSubmission({ ...payload }, env, now + 5_000);
    const mismatch = await reserveContactSubmission(
      { ...payload, email: "other@example.com" },
      env,
      now + 6_000
    );

    expect(first.kind).toBe("reserved");
    expect(retry).toEqual(first);
    expect(mismatch).toEqual({ kind: "mismatch" });
    expect(rateLimitDatabase.rows).toHaveLength(1);
  });

  it.each([
    ["first name", { firstName: "Morgan" }],
    ["last name", { lastName: "Lee" }],
    ["phone", { phone: "+1 425 555 0100" }],
    ["message", { message: "This is a different inquiry." }],
    ["start time", { startedAt: validStartedAt - 1_000 }]
  ])("rejects a same-ID retry with a changed %s", async (_field, override) => {
    const now = Date.UTC(2026, 7, 30, 12, 0, 0);
    const payload = validPayload();

    await expect(reserveContactSubmission(payload, env, now)).resolves.toMatchObject({ kind: "reserved" });
    await expect(
      reserveContactSubmission({ ...payload, ...override } as ContactPayload, env, now + 1_000)
    ).resolves.toEqual({ kind: "mismatch" });
    expect(rateLimitDatabase.rows).toHaveLength(1);
  });

  it("fails closed when a migrated reservation has no payload fingerprint", async () => {
    const now = Date.UTC(2026, 7, 30, 12, 0, 0);
    const payload = validPayload();
    await reserveContactSubmission(payload, env, now);
    const row = rateLimitDatabase.rows.get(submissionId);
    if (!row) throw new Error("Expected the initial reservation.");
    row.payload_hash = null;

    await expect(reserveContactSubmission(payload, env, now + 1_000)).resolves.toEqual({ kind: "mismatch" });
  });

  it("removes expired reservations and permits a fresh rolling-window submission", async () => {
    const now = Date.UTC(2026, 7, 30, 12, 0, 0);
    await reserveContactSubmission(validPayload(), env, now);
    await reserveContactSubmission(validPayload({ submissionId: otherSubmissionId }), env, now + 1_000);

    const afterExpiry = await reserveContactSubmission(
      validPayload({ submissionId: thirdSubmissionId }),
      env,
      now + CONTACT_RATE_LIMIT_WINDOW_SECONDS * 1_000
    );

    expect(afterExpiry.kind).toBe("reserved");
    expect(rateLimitDatabase.rows.has(submissionId)).toBe(false);
    expect(rateLimitDatabase.rows).toHaveLength(2);
  });

  it("serializes concurrent reservations so only two succeed", async () => {
    const now = Date.UTC(2026, 7, 30, 12, 0, 0);
    const results = await Promise.all(
      [submissionId, otherSubmissionId, thirdSubmissionId].map((id) =>
        reserveContactSubmission(validPayload({ submissionId: id }), env, now)
      )
    );

    expect(results.filter((result) => result.kind === "reserved")).toHaveLength(2);
    expect(results.filter((result) => result.kind === "rate-limited")).toHaveLength(1);
    expect(rateLimitDatabase.rows).toHaveLength(2);
  });
});

describe("sequential contact delivery", () => {
  it("sends the visitor first, then the owner with stable distinct idempotency keys", async () => {
    const payload = validPayload({
      firstName: "Avery <script>",
      lastName: "Nguyen & Co.",
      message: "Hello <img src=x onerror=alert(1)>\nSecond line"
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mxResponse())
      .mockResolvedValueOnce(resendAccepted("visitor-id"))
      .mockResolvedValueOnce(resendAccepted("owner-id"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(payload, { cookie: await ticketCookie() }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.resend.com/emails");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://api.resend.com/emails");

    const visitorInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const ownerInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(new Headers(visitorInit.headers).get("Idempotency-Key")).toBe(
      `portfolio-contact/visitor/${submissionId}`
    );
    expect(new Headers(ownerInit.headers).get("Idempotency-Key")).toBe(
      `portfolio-contact/owner/${submissionId}`
    );
    expect(JSON.parse(String(visitorInit.body))).toMatchObject({
      to: ["avery@example.com"],
      reply_to: configuredReplyToEmail,
      subject: "I received your message!"
    });
    expect(JSON.parse(String(ownerInit.body))).toMatchObject({
      to: [privateRecipient],
      reply_to: "avery@example.com",
      subject: "New contact request from Avery <script> Nguyen & Co."
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("siteverify"))).toBe(false);
  });

  it("uses only Resend status and cancels unread provider bodies", async () => {
    let cancellationCount = 0;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mxResponse())
      .mockResolvedValueOnce(stalledJsonResponse(() => {
        cancellationCount += 1;
      }, 202))
      .mockResolvedValueOnce(stalledJsonResponse(() => {
        cancellationCount += 1;
      }, 202));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload(), { cookie: await ticketCookie() }));

    expect(response.status).toBe(200);
    expect(cancellationCount).toBe(2);
    const resendCalls = fetchMock.mock.calls.filter(([url]) => url === "https://api.resend.com/emails");
    expect(resendCalls).toHaveLength(2);
    expect((resendCalls[0]?.[1] as RequestInit).redirect).toBe("error");
    expect((resendCalls[1]?.[1] as RequestInit).redirect).toBe("error");
  });

  it("does not contact the owner when visitor delivery is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mxResponse())
      .mockResolvedValueOnce(Response.json({ message: "rejected" }, { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(requestFor(validPayload(), { cookie: await ticketCookie() }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "delivery_failed" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rateLimitDatabase.rows).toHaveLength(1);
  });

  it("retains the ticket and reservation after partial failure and safely retries both stable keys", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mxResponse())
      .mockResolvedValueOnce(resendAccepted("visitor-id"))
      .mockResolvedValueOnce(Response.json({ message: "temporary failure" }, { status: 500 }))
      .mockResolvedValueOnce(mxResponse())
      .mockResolvedValueOnce(resendAccepted("visitor-id"))
      .mockResolvedValueOnce(resendAccepted("owner-id"));
    vi.stubGlobal("fetch", fetchMock);

    const cookie = await ticketCookie();
    const payload = validPayload();
    const first = await invoke(requestFor(payload, { cookie }));
    const retry = await invoke(requestFor(payload, { cookie }));

    expect(first.status).toBe(502);
    expect(first.headers.get("Set-Cookie")).toBeNull();
    expect(retry.status).toBe(200);
    expect(rateLimitDatabase.rows).toHaveLength(1);
    const resendCalls = fetchMock.mock.calls.filter(([url]) => url === "https://api.resend.com/emails");
    expect(
      resendCalls.map(([, init]) => new Headers((init as RequestInit).headers).get("Idempotency-Key"))
    ).toEqual([
      `portfolio-contact/visitor/${submissionId}`,
      `portfolio-contact/owner/${submissionId}`,
      `portfolio-contact/visitor/${submissionId}`,
      `portfolio-contact/owner/${submissionId}`
    ]);
  });

  it("rejects a changed payload after a partial delivery without making another Resend request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mxResponse())
      .mockResolvedValueOnce(resendAccepted("visitor-id"))
      .mockResolvedValueOnce(Response.json({ message: "temporary failure" }, { status: 500 }))
      .mockResolvedValueOnce(mxResponse());
    vi.stubGlobal("fetch", fetchMock);

    const cookie = await ticketCookie();
    const payload = validPayload();
    const first = await invoke(requestFor(payload, { cookie }));
    const changed = await invoke(
      requestFor({ ...payload, message: "A different valid message." }, { cookie })
    );

    expect(first.status).toBe(502);
    expect(changed.status).toBe(400);
    expect(await changed.json()).toEqual({ ok: false, error: "invalid_request" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.filter(([url]) => url === "https://api.resend.com/emails")).toHaveLength(2);
  });

  it("maps domain, D1, mismatch, and quota outcomes without sending email", async () => {
    const invalidDomainFetch = vi.fn().mockResolvedValueOnce(Response.json({ Status: 3 }));
    vi.stubGlobal("fetch", invalidDomainFetch);
    const invalidDomain = await invoke(requestFor(validPayload(), { cookie: await ticketCookie() }));
    expect(invalidDomain.status).toBe(422);
    expect(await invalidDomain.json()).toEqual({ ok: false, error: "invalid_email" });
    expect(rateLimitDatabase.rows).toHaveLength(0);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })));
    const dnsUnavailable = await invoke(requestFor(validPayload(), { cookie: await ticketCookie() }));
    expect(dnsUnavailable.status).toBe(503);
    expect(await dnsUnavailable.json()).toEqual({ ok: false, error: "email_validation_unavailable" });

    rateLimitDatabase.fail = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mxResponse()));
    const d1Unavailable = await invoke(requestFor(validPayload(), { cookie: await ticketCookie() }));
    expect(d1Unavailable.status).toBe(503);
    expect(await d1Unavailable.json()).toEqual({ ok: false, error: "service_unavailable" });
    rateLimitDatabase.fail = false;

    await reserveContactSubmission(validPayload({ email: "first@example.com" }), env);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mxResponse()));
    const mismatch = await invoke(
      requestFor(validPayload({ email: "second@example.com" }), { cookie: await ticketCookie() })
    );
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toEqual({ ok: false, error: "invalid_request" });
  });

  it("returns 429 with Retry-After after two rolling-window reservations", async () => {
    await reserveContactSubmission(validPayload(), env);
    await reserveContactSubmission(validPayload({ submissionId: otherSubmissionId }), env);
    const fetchMock = vi.fn().mockResolvedValueOnce(mxResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await invoke(
      requestFor(validPayload({ submissionId: thirdSubmissionId }), {
        cookie: await ticketCookie(thirdSubmissionId)
      })
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ ok: false, error: "rate_limited" });
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("contact email templates", () => {
  it("keeps legal content external-only and escapes all visitor-provided HTML", () => {
    const [visitor, owner] = createEmailMessages(
      validPayload({
        firstName: "Avery <script>",
        lastName: "Nguyen & Co.",
        message: "Hello <img src=x onerror=alert(1)>\nSecond line"
      }),
      privateRecipient,
      configuredFromEmail,
      configuredReplyToEmail,
      2026
    );

    expect(visitor).toMatchObject({
      from: configuredFromEmail,
      to: ["avery@example.com"],
      reply_to: configuredReplyToEmail,
      subject: "I received your message!"
    });
    expect(visitor.text).toContain("Information you submitted");
    expect(visitor.text).toContain("https://nicolasmgioanni.dev/privacy");
    expect(visitor.text).toContain("https://nicolasmgioanni.dev/terms");
    expect(visitor.text).toContain("© 2026 Nicolas Gioanni. All rights reserved.");
    expect(visitor.html).toContain("Privacy Notice");
    expect(visitor.html).toContain("Site Terms &amp; Accuracy Notice");
    expect(visitor.html).toContain("Avery &lt;script&gt;");
    expect(visitor.html).toContain("&lt;img src=x onerror=alert(1)&gt;<br>Second line");
    expect(visitor.html).not.toContain("<script>");
    expect(visitor.html).not.toContain("<img");

    expect(owner).toMatchObject({
      from: configuredFromEmail,
      to: [privateRecipient],
      reply_to: "avery@example.com",
      subject: "New contact request from Avery <script> Nguyen & Co."
    });
    expect(owner.html).toContain('href="mailto:avery@example.com"');
    expect(owner.html).not.toContain("Privacy Notice");
    expect(owner.html).not.toContain("Site Terms");
    expect(owner.text).not.toContain("Acknowledgments");
  });
});
