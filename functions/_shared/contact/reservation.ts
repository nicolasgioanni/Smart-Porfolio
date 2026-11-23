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
  CONTACT_IP_LIMIT_WINDOW_SECONDS,
  CONTACT_IP_LIMIT_MAX_SUBMISSIONS,
  CONTACT_GLOBAL_LIMIT_MAX_SUBMISSIONS,
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
const IP_HKDF_SALT = "portfolio-contact-ip-rate-limit:v1:hkdf-salt";
const IP_HKDF_INFO = "portfolio-contact-ip-rate-limit:v1:hmac-key";
const D1_RESERVATION_TIMEOUT_MS = 3_000;

export async function reserveContactSubmission(
  payload: ContactPayload,
  env: ContactEnv,
  ip: string | undefined,
  now = Date.now(),
  operationDeadline?: Deadline
): Promise<ContactReservationResult> {
  const canonicalIp = canonicalizeIp(ip);
  const database = env.CONTACT_RATE_LIMIT_DB;
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!canonicalIp || !isContactRateLimitDatabase(database) || !secret || !Number.isFinite(now) || now < 0) {
    return { kind: "unavailable" };
  }

  const nowSeconds = Math.floor(now / 1_000);
  const expiresAt = nowSeconds + CONTACT_RATE_LIMIT_WINDOW_SECONDS;
  const cryptoDeadline = reservationDeadline(operationDeadline);
  if (!cryptoDeadline) return { kind: "unavailable" };
  let hashes: readonly [string | undefined, string | undefined, string | undefined, string | undefined] | undefined;
  try {
    hashes = await awaitWithDeadlines(
      Promise.all([
        createRateLimitEmailHash(payload.email, secret, cryptoDeadline, operationDeadline),
        createContactPayloadFingerprint(payload, secret, cryptoDeadline, operationDeadline),
        createDeliveryConfigFingerprint(env, secret, cryptoDeadline, operationDeadline),
        createIpHash(canonicalIp, secret, cryptoDeadline, operationDeadline)
      ] as const),
      cryptoDeadline,
      operationDeadline
    );
  } catch {
    return { kind: "unavailable" };
  } finally {
    cryptoDeadline.clear();
  }
  const [emailHash, payloadHash, deliveryConfigHash, ipHash] = hashes ?? [];
  if (!emailHash || !payloadHash || !deliveryConfigHash || !ipHash || operationDeadline?.isExpired()) return { kind: "unavailable" };

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
          expiresAt,
          ipHash
        ),
      database
        .prepare(
          "SELECT email_hash, payload_hash, delivery_config_hash, render_version, reserved_at, expires_at FROM contact_rate_reservations WHERE submission_id = ? LIMIT 1"
        )
        .bind(payload.submissionId),
      database
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM contact_rate_reservations WHERE email_hash = ?1 AND expires_at > ?3) AS email_count,
            (SELECT expires_at FROM contact_rate_reservations WHERE email_hash = ?1 AND expires_at > ?3 ORDER BY expires_at DESC LIMIT 1 OFFSET ${CONTACT_RATE_LIMIT_MAX_SUBMISSIONS - 1}) AS email_release,
            (SELECT COUNT(*) FROM contact_rate_reservations WHERE ip_hash = ?2 AND reserved_at > ?3 - ${CONTACT_IP_LIMIT_WINDOW_SECONDS} AND expires_at > ?3) AS ip_count,
            (SELECT reserved_at + ${CONTACT_IP_LIMIT_WINDOW_SECONDS} FROM contact_rate_reservations WHERE ip_hash = ?2 AND reserved_at > ?3 - ${CONTACT_IP_LIMIT_WINDOW_SECONDS} AND expires_at > ?3 ORDER BY reserved_at DESC LIMIT 1 OFFSET ${CONTACT_IP_LIMIT_MAX_SUBMISSIONS - 1}) AS ip_release,
            (SELECT COUNT(*) FROM contact_rate_reservations WHERE expires_at > ?3) AS global_count,
            (SELECT expires_at FROM contact_rate_reservations WHERE expires_at > ?3 ORDER BY expires_at DESC LIMIT 1 OFFSET ${CONTACT_GLOBAL_LIMIT_MAX_SUBMISSIONS - 1}) AS global_release`
        )
        .bind(emailHash, ipHash, nowSeconds)
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
    if (results.length !== statements.length || results.some((result) => result.success !== true) ||
        !Array.isArray(results[2].results) || results[2].results.length > 1 ||
        !Array.isArray(results[3].results) || results[3].results.length !== 1) {
      return { kind: "unavailable" };
    }

    const quota = firstResultRow(results[3]);
    if (!quota) return { kind: "unavailable" };
    const budgets = [
      ["email_count", "email_release", CONTACT_RATE_LIMIT_MAX_SUBMISSIONS, CONTACT_RATE_LIMIT_WINDOW_SECONDS],
      ["ip_count", "ip_release", CONTACT_IP_LIMIT_MAX_SUBMISSIONS, CONTACT_IP_LIMIT_WINDOW_SECONDS],
      ["global_count", "global_release", CONTACT_GLOBAL_LIMIT_MAX_SUBMISSIONS, CONTACT_RATE_LIMIT_WINDOW_SECONDS]
    ] as const;
    let release = nowSeconds;
    for (const [countKey, releaseKey, limit, window] of budgets) {
      const count = safeIntegerValue(quota[countKey]);
      if (count === undefined || count < 0) return { kind: "unavailable" };
      if (count >= limit) {
        const expiry = safeIntegerValue(quota[releaseKey]);
        if (expiry === undefined || expiry <= nowSeconds || expiry > nowSeconds + window) {
          return { kind: "unavailable" };
        }
        release = Math.max(release, expiry);
      } else if (quota[releaseKey] !== null) {
        return { kind: "unavailable" };
      }
    }

    const reservation = firstResultRow(results[2]);
    if (results[2].results.length && !reservation) return { kind: "unavailable" };
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
      const expiresAt = safeIntegerValue(reservation.expires_at);
      return reservedAt === undefined || expiresAt !== reservedAt + CONTACT_RATE_LIMIT_WINDOW_SECONDS || expiresAt <= nowSeconds
        ? { kind: "unavailable" }
        : { kind: "reserved", reservedAt, renderVersion: CONTACT_EMAIL_RENDER_VERSION };
    }

    if (release > nowSeconds) return { kind: "rate-limited", retryAfterSeconds: release - nowSeconds };
  } catch {
    return { kind: "unavailable" };
  }

  return { kind: "unavailable" };
}

// Only a single canonical address from the trusted Functions header is accepted.
export function canonicalizeIp(value: string | undefined): string | undefined {
  if (!value || value !== value.trim() || value.length > 45) return undefined;
  if (/^[0-9.]+$/.test(value)) {
    const parts = value.split(".");
    if (parts.length !== 4 || parts.some((part) => !/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255)) return undefined;
    return parts.join(".");
  }
  if (!value.includes(":") || !/^[0-9a-fA-F:.]+$/.test(value)) return undefined;
  try {
    const host = new URL(`http://[${value}]/`).hostname;
    if (!host.startsWith("[") || !host.endsWith("]")) return undefined;
    const canonical = host.slice(1, -1);
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
    if (mapped) {
      const high = Number.parseInt(mapped[1], 16);
      const low = Number.parseInt(mapped[2], 16);
      return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
    }
    return canonical;
  } catch {
    return undefined;
  }
}

async function createIpHash(ip: string, secret: string, deadline: Deadline, operationDeadline?: Deadline): Promise<string | undefined> {
  const key = await deriveRateLimitKey(secret, deadline, operationDeadline, IP_HKDF_SALT, IP_HKDF_INFO);
  if (!key) return undefined;
  const signed = await startWithinDeadlines(
    () => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip)), deadline, operationDeadline
  );
  return signed ? encodeBase64Url(new Uint8Array(signed)) : undefined;
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
  operationDeadline?: Deadline,
  salt = RATE_LIMIT_HKDF_SALT,
  info = RATE_LIMIT_HKDF_INFO
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
        salt: encoder.encode(salt),
        info: encoder.encode(info)
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
