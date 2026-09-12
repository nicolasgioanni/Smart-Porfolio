import {
  contactFieldLimits,
  hasUnsafeControlCharacters,
  isValidEmail,
  isValidHumanText,
  isValidPhone
} from "../../../src/lib/contact/validation";
import type {
  ContactPayload,
  PayloadResult,
  TurnstileVerificationPayloadResult
} from "./contracts";
import { isPlainObject } from "./values";

const MIN_COMPLETION_TIME_MS = 1_200;
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 30_000;
const CONTACT_KEYS = new Set([
  "submissionId",
  "firstName",
  "lastName",
  "email",
  "phone",
  "message",
  "contactConsent",
  "legalConsent",
  "startedAt",
  "website"
]);
const TURNSTILE_VERIFICATION_KEYS = new Set(["submissionId", "turnstileToken"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseContactPayload(value: unknown, now = Date.now()): PayloadResult {
  if (!isPlainObject(value)) return { kind: "invalid" };
  if (Object.keys(value).some((key) => !CONTACT_KEYS.has(key))) return { kind: "invalid" };

  const website = stringValue(value.website);
  if (website === undefined || website.length > 200) return { kind: "invalid" };
  if (website.trim()) return { kind: "spam" };

  const startedAt = value.startedAt;
  if (!Number.isSafeInteger(startedAt) || typeof startedAt !== "number") return { kind: "invalid" };
  if (startedAt > now + MAX_CLOCK_SKEW_MS) return { kind: "invalid" };
  const formAge = now - startedAt;
  const formExpired = formAge > MAX_FORM_AGE_MS;
  if (!formExpired && formAge < MIN_COMPLETION_TIME_MS) return { kind: "spam" };

  const submissionId = normalizedString(value.submissionId);
  const firstName = normalizedString(value.firstName);
  const lastName = normalizedString(value.lastName);
  const email = normalizedString(value.email);
  if (value.phone !== undefined && typeof value.phone !== "string") return { kind: "invalid" };
  const phone = normalizedString(value.phone) ?? "";
  const message = normalizedMultilineString(value.message);

  if (!submissionId || !UUID_PATTERN.test(submissionId)) return { kind: "invalid" };
  if (!isValidHumanText(firstName, contactFieldLimits.firstName) || !isValidHumanText(lastName, contactFieldLimits.lastName)) {
    return { kind: "invalid" };
  }
  if (!email || !isValidEmail(email)) return { kind: "invalid" };
  if (!isValidPhone(phone)) return { kind: "invalid" };
  if (!message || message.length > contactFieldLimits.message || hasUnsafeControlCharacters(message)) {
    return { kind: "invalid" };
  }
  if (value.contactConsent !== true || value.legalConsent !== true) {
    return { kind: "invalid" };
  }
  if (formExpired) return { kind: "expired" };

  return {
    kind: "valid",
    payload: {
      submissionId,
      firstName,
      lastName,
      email,
      phone,
      message,
      contactConsent: true,
      legalConsent: true,
      startedAt,
      website: ""
    } satisfies ContactPayload
  };
}

export function parseTurnstileVerificationPayload(value: unknown): TurnstileVerificationPayloadResult {
  if (!isPlainObject(value)) return { kind: "invalid" };
  if (
    Object.keys(value).length !== TURNSTILE_VERIFICATION_KEYS.size ||
    Object.keys(value).some((key) => !TURNSTILE_VERIFICATION_KEYS.has(key))
  ) {
    return { kind: "invalid" };
  }

  const submissionId = normalizedString(value.submissionId);
  const turnstileToken = stringValue(value.turnstileToken)?.trim();
  if (!submissionId || !UUID_PATTERN.test(submissionId)) return { kind: "invalid" };
  if (!turnstileToken || turnstileToken.length > 2_048 || hasUnsafeControlCharacters(turnstileToken)) {
    return { kind: "invalid" };
  }

  return { kind: "valid", payload: { submissionId, turnstileToken } };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizedString(value: unknown): string | undefined {
  return stringValue(value)?.trim();
}

function normalizedMultilineString(value: unknown): string | undefined {
  return stringValue(value)?.replace(/\r\n?/g, "\n").trim();
}
