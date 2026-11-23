// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CONTACT_TICKET_COOKIE_NAME,
  createContactTicket,
  hasValidContactTicket,
  isAllowedOrigin,
  parseContactPayload,
  parseTurnstileVerificationPayload,
  readJsonBody,
  type ContactEnv
} from "../../functions/_shared/contact";

const now = 1_768_160_000_000;
const submissionId = "4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9";
const contactEnvironment: ContactEnv = {
  CONTACT_ALLOWED_ORIGINS: "https://portfolio.example.com,https://preview.portfolio.example.com",
  TURNSTILE_SECRET_KEY: "quality-property-ticket-secret"
};

function seeded(seed = 0x5a17c0de) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state;
  };
}

function validContactPayload(overrides: Record<string, unknown> = {}) {
  return {
    submissionId,
    firstName: "Avery",
    lastName: "Nguyen",
    email: "avery@example.com",
    phone: "+1 (206) 555-0123",
    message: "A concise, professional request with sufficient detail.\nThank you.",
    contactConsent: true,
    legalConsent: true,
    startedAt: now - 5_000,
    website: "",
    ...overrides
  };
}

function request(origin: string | undefined, target = "https://portfolio.example.com/api/contact") {
  return new Request(target, {
    method: "POST",
    headers: origin === undefined ? {} : { Origin: origin },
    body: "{}"
  });
}

function tamper(value: string, index: number) {
  const replacement = value[index] === "A" ? "B" : "A";
  return `${value.slice(0, index)}${replacement}${value.slice(index + 1)}`;
}

describe("seeded contact boundary properties", () => {
  it("rejects adversarial unknown fields while preserving a canonical valid UTF-8 payload", () => {
    const canonical = parseContactPayload(validContactPayload({
      firstName: " Åvery ",
      lastName: "Nguyễn",
      message: "\r\nA carefully written request.\r\n"
    }), now);
    expect(canonical).toMatchObject({
      kind: "valid",
      payload: { firstName: "Åvery", lastName: "Nguyễn", message: "A carefully written request.", website: "" }
    });

    const next = seeded();
    const values: unknown[] = [null, false, 0, ["nested"], { nested: true }, "\u0000", "雪"];
    for (let index = 0; index < 128; index += 1) {
      const key = `adversarial_${next().toString(36)}_${index}`;
      const parsed = parseContactPayload(validContactPayload({ [key]: values[next() % values.length] }), now);
      expect(parsed, `seeded unknown key ${key}`).toEqual({ kind: "invalid" });
    }
  });

  it("keeps ticket, token, and schema acceptance bound to exact IDs and fields", async () => {
    const ticket = await createContactTicket(submissionId, contactEnvironment, now);
    expect(ticket).toBeTruthy();
    const validRequest = new Request("https://portfolio.example.com/api/contact", {
      headers: { Cookie: `${CONTACT_TICKET_COOKIE_NAME}=${ticket}` }
    });
    await expect(hasValidContactTicket(validRequest, submissionId, contactEnvironment, now + 1_000)).resolves.toBe(true);

    const next = seeded(0x51deed);
    for (let index = 0; index < 96; index += 1) {
      const tampered = tamper(ticket!, next() % ticket!.length);
      const requestWithTamperedTicket = new Request("https://portfolio.example.com/api/contact", {
        headers: { Cookie: `${CONTACT_TICKET_COOKIE_NAME}=${tampered}` }
      });
      await expect(hasValidContactTicket(requestWithTamperedTicket, submissionId, contactEnvironment, now + 1_000)).resolves.toBe(false);

      const token = `${"token".repeat((next() % 20) + 1)}${index}`;
      const parsed = parseTurnstileVerificationPayload({
        submissionId,
        turnstileToken: token,
        [`unknown_${index}`]: true
      });
      expect(parsed, `token schema mutation ${index}`).toEqual({ kind: "invalid" });
    }
  });

  it("fails closed for noncanonical origins and malformed UTF-8 request bodies", async () => {
    expect(isAllowedOrigin(request("https://portfolio.example.com"), contactEnvironment.CONTACT_ALLOWED_ORIGINS)).toBe(true);
    const adversarialOrigins = [
      undefined,
      "null",
      "https://attacker.example",
      "https://portfolio.example.com.evil.example",
      "https://portfolio.example.com/path",
      "https://portfolio.example.com?next=attacker",
      "https://user@portfolio.example.com",
      "https://portfolio.example.com:444",
      "javascript:alert(1)",
      "https://preview.portfolio.example.com#fragment"
    ];
    for (const origin of adversarialOrigins) {
      expect(isAllowedOrigin(request(origin), contactEnvironment.CONTACT_ALLOWED_ORIGINS), `origin ${String(origin)}`).toBe(false);
    }
    expect(isAllowedOrigin(request("https://portfolio.example.com"), "https://portfolio.example.com/path")).toBe(false);
    expect(isAllowedOrigin(request("https://preview.portfolio.example.com", "https://preview.portfolio.example.com/api/contact"), contactEnvironment.CONTACT_ALLOWED_ORIGINS)).toBe(true);

    const malformedUtf8 = new Request("https://portfolio.example.com/api/contact", {
      method: "POST",
      body: new Uint8Array([0xc3, 0x28])
    });
    await expect(readJsonBody(malformedUtf8)).resolves.toEqual({ kind: "invalid" });
  });
});
