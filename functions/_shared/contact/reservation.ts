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
import { createDeliveryIdentity } from "./delivery";
import { awaitWithDeadline, createDeadline, type Deadline } from "./transport";

const RATE_LIMIT_HKDF_SALT = "portfolio-contact-rate-limit:v1:hkdf-salt";
const RATE_LIMIT_HKDF_INFO = "portfolio-contact-rate-limit:v1:email-hmac-key";
const PAYLOAD_FINGERPRINT_HKDF_SALT = "portfolio-contact-payload-fingerprint:v1:hkdf-salt";
const PAYLOAD_FINGERPRINT_HKDF_INFO = "portfolio-contact-payload-fingerprint:v1:hmac-key";
const D1_RESERVATION_TIMEOUT_MS = 5_000;

export async function reserveContactSubmission(
  payload: ContactPayload,
  env: ContactEnv,
  now = Date.now(),
  operationDeadline?: Deadline
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
      createRateLimitEmailHash(payload.email, secret, operationDeadline),
      createContactPayloadFingerprint(payload, secret, createDeliveryIdentity(payload, env), operationDeadline)
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
    if (operationDeadline?.isExpired()) return { kind: "unavailable" };
    // D1 cannot cancel an issued batch. A late completion is ignored here; a
    // same-ID retry reads the atomic reservation instead of sending mail twice.
    const databaseDeadline = createDeadline(D1_RESERVATION_TIMEOUT_MS, undefined, operationDeadline);
    const results = await awaitWithDeadline(database.batch<Record<string, unknown>>(statements), databaseDeadline);
    databaseDeadline.clear();
    if (!results || databaseDeadline.isExpired() || operationDeadline?.isExpired()) return { kind: "unavailable" };
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

async function createRateLimitEmailHash(email: string, secret: string, deadline?: Deadline): Promise<string> {
  const key = await awaitCrypto(deriveRateLimitKey(secret), deadline);
  if (!key) throw new Error("deadline");
  const normalizedEmail = email.trim().toLowerCase();
  const signed = await awaitCrypto(crypto.subtle.sign("HMAC", key, new TextEncoder().encode(normalizedEmail)), deadline);
  if (!signed) throw new Error("deadline");
  const digest = new Uint8Array(signed);
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

async function createContactPayloadFingerprint(
  payload: ContactPayload,
  secret: string,
  deliveryIdentity: string | undefined,
  deadline?: Deadline
): Promise<string> {
  if (!deliveryIdentity) throw new Error("invalid delivery identity");
  const canonicalPayload = JSON.stringify({
    v: 2,
    submissionId: payload.submissionId,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    message: payload.message,
    contactConsent: payload.contactConsent,
    legalConsent: payload.legalConsent,
    startedAt: payload.startedAt,
    website: payload.website,
    deliveryIdentity
  });
  const key = await awaitCrypto(derivePayloadFingerprintKey(secret), deadline);
  if (!key) throw new Error("deadline");
  const signed = await awaitCrypto(crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalPayload)), deadline);
  if (!signed) throw new Error("deadline");
  const digest = new Uint8Array(signed);
  return encodeBase64Url(digest);
}

async function awaitCrypto<T>(operation: Promise<T>, deadline?: Deadline): Promise<T | undefined> {
  if (!deadline) return operation;
  const value = await awaitWithDeadline(operation, deadline);
  return deadline.isExpired() ? undefined : value;
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
