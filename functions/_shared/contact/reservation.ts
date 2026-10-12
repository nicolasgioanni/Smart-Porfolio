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
  CONTACT_EMAIL_RENDER_VERSION,
  CONTACT_RESERVATION_INSERT_SQL
} from "./contracts";
import { encodeBase64Url } from "./base64url";
import { awaitWithDeadlines, createDeadline, startWithinDeadlines, type Deadline } from "./transport";
import { isPlainObject } from "./values";

const RATE_LIMIT_HKDF_SALT = "portfolio-contact-rate-limit:v1:hkdf-salt";
const RATE_LIMIT_HKDF_INFO = "portfolio-contact-rate-limit:v1:email-hmac-key";
const PAYLOAD_FINGERPRINT_HKDF_SALT = "portfolio-contact-payload-fingerprint:v1:hkdf-salt";
const PAYLOAD_FINGERPRINT_HKDF_INFO = "portfolio-contact-payload-fingerprint:v1:hmac-key";
const DELIVERY_CONFIG_FINGERPRINT_HKDF_SALT = "portfolio-contact-delivery-config:v1:hkdf-salt";
const DELIVERY_CONFIG_FINGERPRINT_HKDF_INFO = "portfolio-contact-delivery-config:v1:hmac-key";
const D1_RESERVATION_TIMEOUT_MS = 3_000;

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
  const cryptoDeadline = reservationDeadline(operationDeadline);
  if (!cryptoDeadline) return { kind: "unavailable" };
  let hashes: readonly [string | undefined, string | undefined, string | undefined] | undefined;
  try {
    hashes = await awaitWithDeadlines(
      Promise.all([
        createRateLimitEmailHash(payload.email, secret, cryptoDeadline, operationDeadline),
        createContactPayloadFingerprint(payload, secret, cryptoDeadline, operationDeadline),
        createDeliveryConfigFingerprint(env, secret, cryptoDeadline, operationDeadline)
      ] as const),
      cryptoDeadline,
      operationDeadline
    );
  } catch {
    return { kind: "unavailable" };
  } finally {
    cryptoDeadline.clear();
  }
  const [emailHash, payloadHash, deliveryConfigHash] = hashes ?? [];
  if (!emailHash || !payloadHash || !deliveryConfigHash || operationDeadline?.isExpired()) return { kind: "unavailable" };

  try {
    const statements = [
      database.prepare("DELETE FROM contact_rate_reservations WHERE expires_at <= ?").bind(nowSeconds),
      database
        .prepare(CONTACT_RESERVATION_INSERT_SQL)
        .bind(
          payload.submissionId,
          emailHash,
          payloadHash,
          deliveryConfigHash,
          CONTACT_EMAIL_RENDER_VERSION,
          nowSeconds,
          expiresAt
        ),
      database
        .prepare(
          "SELECT email_hash, payload_hash, delivery_config_hash, render_version, reserved_at, expires_at FROM contact_rate_reservations WHERE submission_id = ? LIMIT 1"
        )
        .bind(payload.submissionId),
      database
        .prepare(
          "SELECT COUNT(*) AS reservation_count, MIN(expires_at) AS next_expiry FROM contact_rate_reservations WHERE email_hash = ? AND expires_at > ?"
        )
        .bind(emailHash, nowSeconds)
    ];
    const deadline = reservationDeadline(operationDeadline);
    if (!deadline) return { kind: "unavailable" };
    let results: Array<ContactRateLimitResult<Record<string, unknown>>> | undefined;
    let deadlineExpired = false;
    try {
      results = await awaitWithDeadlines(database.batch<Record<string, unknown>>(statements), deadline, operationDeadline);
      deadlineExpired = deadline.isExpired();
    } finally {
      deadline.clear();
    }
    if (!results || deadlineExpired || operationDeadline?.isExpired()) return { kind: "unavailable" };
    if (results.length !== statements.length || results.some((result) => result.success !== true)) {
      return { kind: "unavailable" };
    }

    const reservation = firstResultRow(results[2]);
    if (reservation) {
      if (reservation.email_hash !== emailHash || reservation.payload_hash !== payloadHash) {
        return { kind: "mismatch" };
      }
      if (
        reservation.delivery_config_hash !== deliveryConfigHash ||
        reservation.render_version !== CONTACT_EMAIL_RENDER_VERSION
      ) {
        return { kind: "retry-unavailable" };
      }
      const reservedAt = safeIntegerValue(reservation.reserved_at);
      return reservedAt === undefined
        ? { kind: "unavailable" }
        : { kind: "reserved", reservedAt, renderVersion: CONTACT_EMAIL_RENDER_VERSION };
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

function reservationDeadline(operationDeadline?: Deadline): Deadline | undefined {
  const remaining = operationDeadline?.remainingMs() ?? D1_RESERVATION_TIMEOUT_MS;
  if (remaining < 1 || operationDeadline?.isExpired()) return undefined;
  return createDeadline(Math.min(D1_RESERVATION_TIMEOUT_MS, remaining));
}

async function createDeliveryConfigFingerprint(
  env: ContactEnv,
  secret: string,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<string | undefined> {
  const canonicalConfig = JSON.stringify({
    v: CONTACT_EMAIL_RENDER_VERSION,
    from: env.CONTACT_FROM_EMAIL?.trim() ?? "",
    recipient: env.CONTACT_RECIPIENT_EMAIL?.trim() ?? "",
    replyTo: env.CONTACT_REPLY_TO_EMAIL?.trim() ?? ""
  });
  const key = await deriveDeliveryConfigFingerprintKey(secret, deadline, operationDeadline);
  if (!key) return undefined;
  const signed = await startWithinDeadlines(
    () => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalConfig)),
    deadline,
    operationDeadline
  );
  return signed ? encodeBase64Url(new Uint8Array(signed)) : undefined;
}

async function createRateLimitEmailHash(
  email: string,
  secret: string,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<string | undefined> {
  const key = await deriveRateLimitKey(secret, deadline, operationDeadline);
  if (!key) return undefined;
  const normalizedEmail = email.trim().toLowerCase();
  const signed = await startWithinDeadlines(
    () => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(normalizedEmail)),
    deadline,
    operationDeadline
  );
  return signed ? encodeBase64Url(new Uint8Array(signed)) : undefined;
}

async function deriveRateLimitKey(
  secret: string,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<CryptoKey | undefined> {
  const encoder = new TextEncoder();
  const keyMaterial = await startWithinDeadlines(
    () => crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]),
    deadline,
    operationDeadline
  );
  if (!keyMaterial) return undefined;

  return startWithinDeadlines(
    () => crypto.subtle.deriveKey(
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
    ),
    deadline,
    operationDeadline
  );
}

async function createContactPayloadFingerprint(
  payload: ContactPayload,
  secret: string,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<string | undefined> {
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
  const key = await derivePayloadFingerprintKey(secret, deadline, operationDeadline);
  if (!key) return undefined;
  const signed = await startWithinDeadlines(
    () => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalPayload)),
    deadline,
    operationDeadline
  );
  return signed ? encodeBase64Url(new Uint8Array(signed)) : undefined;
}

async function derivePayloadFingerprintKey(
  secret: string,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<CryptoKey | undefined> {
  const encoder = new TextEncoder();
  const keyMaterial = await startWithinDeadlines(
    () => crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]),
    deadline,
    operationDeadline
  );
  if (!keyMaterial) return undefined;

  return startWithinDeadlines(
    () => crypto.subtle.deriveKey(
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
    ),
    deadline,
    operationDeadline
  );
}

async function deriveDeliveryConfigFingerprintKey(
  secret: string,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<CryptoKey | undefined> {
  const encoder = new TextEncoder();
  const keyMaterial = await startWithinDeadlines(
    () => crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]),
    deadline,
    operationDeadline
  );
  if (!keyMaterial) return undefined;
  return startWithinDeadlines(
    () => crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode(DELIVERY_CONFIG_FINGERPRINT_HKDF_SALT),
        info: encoder.encode(DELIVERY_CONFIG_FINGERPRINT_HKDF_INFO)
      },
      keyMaterial,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"]
    ),
    deadline,
    operationDeadline
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
