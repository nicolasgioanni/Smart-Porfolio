import type {
  ContactEnv,
  ContactPayload,
  ContactRateLimitDatabase,
  ContactRateLimitResult,
  ContactReservationResult
} from "./contracts";
import {
  CONTACT_RATE_LIMIT_MAX_SUBMISSIONS,
  CONTACT_RATE_LIMIT_WINDOW_SECONDS,
  CONTACT_RESERVATION_INSERT_SQL
} from "./contracts";
import { encodeBase64Url } from "./base64url";
import { isPlainObject } from "./values";

const RATE_LIMIT_HKDF_SALT = "portfolio-contact-rate-limit:v1:hkdf-salt";
const RATE_LIMIT_HKDF_INFO = "portfolio-contact-rate-limit:v1:email-hmac-key";
const PAYLOAD_FINGERPRINT_HKDF_SALT = "portfolio-contact-payload-fingerprint:v1:hkdf-salt";
const PAYLOAD_FINGERPRINT_HKDF_INFO = "portfolio-contact-payload-fingerprint:v1:hmac-key";

export async function reserveContactSubmission(
  payload: ContactPayload,
  env: ContactEnv,
  now = Date.now()
): Promise<ContactReservationResult> {
  const database = env.CONTACT_RATE_LIMIT_DB;
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!isContactRateLimitDatabase(database) || !secret || !Number.isFinite(now) || now < 0) {
    return { kind: "unavailable" };
  }

  const nowSeconds = Math.floor(now / 1_000);
  const expiresAt = nowSeconds + CONTACT_RATE_LIMIT_WINDOW_SECONDS;
  let emailHash: string;
  let payloadHash: string;
  try {
    [emailHash, payloadHash] = await Promise.all([
      createRateLimitEmailHash(payload.email, secret),
      createContactPayloadFingerprint(payload, secret)
    ]);
  } catch {
    return { kind: "unavailable" };
  }

  try {
    const statements = [
      database.prepare("DELETE FROM contact_rate_reservations WHERE expires_at <= ?").bind(nowSeconds),
      database
        .prepare(CONTACT_RESERVATION_INSERT_SQL)
        .bind(payload.submissionId, emailHash, payloadHash, nowSeconds, expiresAt),
      database
        .prepare(
          "SELECT email_hash, payload_hash, reserved_at, expires_at FROM contact_rate_reservations WHERE submission_id = ? LIMIT 1"
        )
        .bind(payload.submissionId),
      database
        .prepare(
          "SELECT COUNT(*) AS reservation_count, MIN(expires_at) AS next_expiry FROM contact_rate_reservations WHERE email_hash = ? AND expires_at > ?"
        )
        .bind(emailHash, nowSeconds)
    ];
    const results = await database.batch<Record<string, unknown>>(statements);
    if (results.length !== statements.length || results.some((result) => result.success !== true)) {
      return { kind: "unavailable" };
    }

    const reservation = firstResultRow(results[2]);
    if (reservation) {
      if (reservation.email_hash !== emailHash || reservation.payload_hash !== payloadHash) {
        return { kind: "mismatch" };
      }
      const reservedAt = safeIntegerValue(reservation.reserved_at);
      return reservedAt === undefined ? { kind: "unavailable" } : { kind: "reserved", reservedAt };
    }

    const quota = firstResultRow(results[3]);
    const reservationCount = safeIntegerValue(quota?.reservation_count);
    const nextExpiry = safeIntegerValue(quota?.next_expiry);
    if (
      reservationCount !== undefined &&
      reservationCount >= CONTACT_RATE_LIMIT_MAX_SUBMISSIONS &&
      nextExpiry !== undefined
    ) {
      return { kind: "rate-limited", retryAfterSeconds: Math.max(1, nextExpiry - nowSeconds) };
    }
  } catch {
    return { kind: "unavailable" };
  }

  return { kind: "unavailable" };
}

async function createRateLimitEmailHash(email: string, secret: string): Promise<string> {
  const key = await deriveRateLimitKey(secret);
  const normalizedEmail = email.trim().toLowerCase();
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(normalizedEmail)));
  return encodeBase64Url(digest);
}

async function deriveRateLimitKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(RATE_LIMIT_HKDF_SALT),
      info: encoder.encode(RATE_LIMIT_HKDF_INFO)
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"]
  );
}

async function createContactPayloadFingerprint(payload: ContactPayload, secret: string): Promise<string> {
  const canonicalPayload = JSON.stringify({
    v: 1,
    submissionId: payload.submissionId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    message: payload.message,
    contactConsent: payload.contactConsent,
    legalConsent: payload.legalConsent,
    startedAt: payload.startedAt,
    website: payload.website
  });
  const key = await derivePayloadFingerprintKey(secret);
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalPayload))
  );
  return encodeBase64Url(digest);
}

async function derivePayloadFingerprintKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(PAYLOAD_FINGERPRINT_HKDF_SALT),
      info: encoder.encode(PAYLOAD_FINGERPRINT_HKDF_INFO)
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"]
  );
}

function isContactRateLimitDatabase(value: unknown): value is ContactRateLimitDatabase {
  if (!isPlainObject(value)) return false;
  return typeof value.prepare === "function" && typeof value.batch === "function";
}

function firstResultRow(
  result: ContactRateLimitResult<Record<string, unknown>> | undefined
): Record<string, unknown> | undefined {
  const row = result?.results?.[0];
  return isPlainObject(row) ? row : undefined;
}

function safeIntegerValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}
