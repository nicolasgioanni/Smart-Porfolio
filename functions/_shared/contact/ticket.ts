import type { ContactEnv } from "./contracts";
import { decodeBase64Url, encodeBase64Url } from "./base64url";

export const CONTACT_TICKET_COOKIE_NAME = "__Host-portfolio_contact_ticket";
export const CONTACT_TICKET_MAX_AGE_SECONDS = 30 * 60;

const CONTACT_TICKET_VERSION = 1;
const CONTACT_TICKET_MAX_LENGTH = 768;
const CONTACT_TICKET_SIGNATURE_BYTES = 32;
const MAX_CLOCK_SKEW_MS = 30_000;
const TICKET_HKDF_SALT = "portfolio-contact-ticket:v1:hkdf-salt";
const TICKET_HKDF_INFO = "portfolio-contact-ticket:v1:hmac-key";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ContactTicketPayload {
  v: 1;
  submissionId: string;
  iat: number;
  exp: number;
}

export async function createContactTicket(
  submissionId: string,
  env: ContactEnv,
  now = Date.now()
): Promise<string | undefined> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !uuidPattern.test(submissionId)) return undefined;

  const issuedAt = Math.floor(now / 1_000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) return undefined;

  const payload: ContactTicketPayload = {
    v: CONTACT_TICKET_VERSION,
    submissionId,
    iat: issuedAt,
    exp: issuedAt + CONTACT_TICKET_MAX_AGE_SECONDS
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

  try {
    const key = await deriveContactTicketKey(secret, ["sign"]);
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
    return `${encodeBase64Url(payloadBytes)}.${encodeBase64Url(signature)}`;
  } catch {
    return undefined;
  }
}

export async function hasValidContactTicket(
  request: Request,
  submissionId: string,
  env: ContactEnv,
  now = Date.now()
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !uuidPattern.test(submissionId)) return false;

  const ticket = readCookie(request, CONTACT_TICKET_COOKIE_NAME);
  if (!ticket || ticket.length > CONTACT_TICKET_MAX_LENGTH) return false;

  const segments = ticket.split(".");
  if (segments.length !== 2) return false;

  const payloadBytes = decodeBase64Url(segments[0] ?? "");
  const signatureBytes = decodeBase64Url(segments[1] ?? "");
  if (!payloadBytes || !signatureBytes || signatureBytes.byteLength !== CONTACT_TICKET_SIGNATURE_BYTES) return false;

  try {
    const key = await deriveContactTicketKey(secret, ["verify"]);
    if (!(await crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes))) return false;

    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
    const parsed = JSON.parse(decoded) as unknown;
    if (!isContactTicketPayload(parsed)) return false;

    const nowSeconds = Math.floor(now / 1_000);
    return (
      parsed.submissionId === submissionId &&
      parsed.iat <= nowSeconds + Math.floor(MAX_CLOCK_SKEW_MS / 1_000) &&
      parsed.exp === parsed.iat + CONTACT_TICKET_MAX_AGE_SECONDS &&
      parsed.exp > nowSeconds
    );
  } catch {
    return false;
  }
}

export function serializeContactTicketCookie(ticket: string): string {
  return `${CONTACT_TICKET_COOKIE_NAME}=${ticket}; Path=/; Max-Age=${CONTACT_TICKET_MAX_AGE_SECONDS}; Secure; HttpOnly; SameSite=Strict`;
}

export function serializeClearedContactTicketCookie(): string {
  return `${CONTACT_TICKET_COOKIE_NAME}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`;
}

function isContactTicketPayload(value: unknown): value is ContactTicketPayload {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== 4 ||
    !keys.includes("v") ||
    !keys.includes("submissionId") ||
    !keys.includes("iat") ||
    !keys.includes("exp")
  ) {
    return false;
  }

  return Boolean(
    value.v === CONTACT_TICKET_VERSION &&
      typeof value.submissionId === "string" &&
      uuidPattern.test(value.submissionId) &&
      typeof value.iat === "number" &&
      Number.isSafeInteger(value.iat) &&
      value.iat >= 0 &&
      typeof value.exp === "number" &&
      Number.isSafeInteger(value.exp) &&
      value.exp > value.iat
  );
}

async function deriveContactTicketKey(secret: string, keyUsages: KeyUsage[]): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(TICKET_HKDF_SALT),
      info: encoder.encode(TICKET_HKDF_INFO)
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    keyUsages
  );
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return undefined;

  let found = false;
  let value: string | undefined;
  for (const segment of cookieHeader.split(";")) {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex < 0) continue;
    const cookieName = segment.slice(0, separatorIndex).trim();
    if (cookieName !== name) continue;
    if (found) return undefined;
    found = true;
    value = segment.slice(separatorIndex + 1).trim();
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
