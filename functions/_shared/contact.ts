export const CONTACT_ACTION = "portfolio_contact";
export const MAX_REQUEST_BYTES = 16_384;
export const CONTACT_TICKET_COOKIE_NAME = "__Host-portfolio_contact_ticket";
export const CONTACT_TICKET_MAX_AGE_SECONDS = 30 * 60;

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const TURNSTILE_TIMEOUT_MS = 5_000;
const RESEND_TIMEOUT_MS = 8_000;
const MIN_COMPLETION_TIME_MS = 1_200;
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 30_000;
const CONTACT_TICKET_VERSION = 1;
const CONTACT_TICKET_MAX_LENGTH = 768;
const CONTACT_TICKET_SIGNATURE_BYTES = 32;
const TICKET_HKDF_SALT = "portfolio-contact-ticket:v1:hkdf-salt";
const TICKET_HKDF_INFO = "portfolio-contact-ticket:v1:hmac-key";

const CONTACT_KEYS = new Set([
  "submissionId",
  "firstName",
  "lastName",
  "email",
  "phone",
  "message",
  "contactConsent",
  "legalConsent",
  "legitimateConsent",
  "startedAt",
  "website"
]);
const TURNSTILE_VERIFICATION_KEYS = new Set(["submissionId", "turnstileToken"]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_LOCAL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const PHONE_CHARACTER_PATTERN = /^[0-9A-Za-z+().,\-\s/#*]+$/;

export interface ContactEnv {
  CONTACT_ALLOWED_ORIGINS?: string;
  CONTACT_FROM_EMAIL?: string;
  CONTACT_RECIPIENT_EMAIL?: string;
  CONTACT_REPLY_TO_EMAIL?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_ALLOWED_HOSTNAMES?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface ContactPayload {
  submissionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  contactConsent: true;
  legalConsent: true;
  legitimateConsent: true;
  startedAt: number;
  website: string;
}

export interface TurnstileVerificationPayload {
  submissionId: string;
  turnstileToken: string;
}

type PayloadResult =
  | { kind: "valid"; payload: ContactPayload }
  | { kind: "spam" }
  | { kind: "invalid" };

type TurnstileVerificationPayloadResult =
  | { kind: "valid"; payload: TurnstileVerificationPayload }
  | { kind: "invalid" };

type ReadBodyResult =
  | { kind: "ok"; value: unknown }
  | { kind: "invalid" }
  | { kind: "too-large" };

interface TurnstileResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
}

interface ContactTicketPayload {
  v: 1;
  submissionId: string;
  iat: number;
  exp: number;
}

interface EmailMessage {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  html: string;
  text: string;
}

export function jsonResponse(status: number, body: Record<string, boolean | string>, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(JSON.stringify(body), { status, headers });
}

export function hasRequiredTurnstileConfiguration(env: ContactEnv): boolean {
  return Boolean(
    env.TURNSTILE_SECRET_KEY?.trim() &&
      parseHostnames(env.TURNSTILE_ALLOWED_HOSTNAMES).length > 0 &&
      parseOrigins(env.CONTACT_ALLOWED_ORIGINS).length > 0
  );
}

export function hasRequiredDeliveryConfiguration(env: ContactEnv): boolean {
  return Boolean(
    env.TURNSTILE_SECRET_KEY?.trim() &&
      parseOrigins(env.CONTACT_ALLOWED_ORIGINS).length > 0 &&
      env.RESEND_API_KEY?.trim() &&
      isValidEmail(env.CONTACT_RECIPIENT_EMAIL?.trim() ?? "") &&
      isValidFromMailbox(env.CONTACT_FROM_EMAIL?.trim() ?? "") &&
      isValidEmail(env.CONTACT_REPLY_TO_EMAIL?.trim() ?? "")
  );
}

export function isAllowedOrigin(request: Request, configuredOrigins?: string): boolean {
  const rawOrigin = request.headers.get("Origin");
  if (!rawOrigin || rawOrigin === "null") return false;

  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return false;

  const allowedOrigins = parseOrigins(configuredOrigins);
  if (allowedOrigins.length === 0) return false;
  return allowedOrigins.includes(origin);
}

export async function readJsonBody(request: Request): Promise<ReadBodyResult> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) return { kind: "invalid" };
    if (parsedLength > MAX_REQUEST_BYTES) return { kind: "too-large" };
  }

  if (!request.body) return { kind: "invalid" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { kind: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { kind: "invalid" };
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { kind: "ok", value: JSON.parse(text) as unknown };
  } catch {
    return { kind: "invalid" };
  }
}

export function parseContactPayload(value: unknown, now = Date.now()): PayloadResult {
  if (!isPlainObject(value)) return { kind: "invalid" };
  if (Object.keys(value).some((key) => !CONTACT_KEYS.has(key))) return { kind: "invalid" };

  const website = stringValue(value.website);
  if (website === undefined || website.length > 200) return { kind: "invalid" };
  if (website.trim()) return { kind: "spam" };

  const startedAt = value.startedAt;
  if (!Number.isSafeInteger(startedAt) || typeof startedAt !== "number") return { kind: "invalid" };
  if (startedAt > now + MAX_CLOCK_SKEW_MS || now - startedAt > MAX_FORM_AGE_MS) return { kind: "invalid" };
  if (now - startedAt < MIN_COMPLETION_TIME_MS) return { kind: "spam" };

  const submissionId = normalizedString(value.submissionId);
  const firstName = normalizedString(value.firstName);
  const lastName = normalizedString(value.lastName);
  const email = normalizedString(value.email);
  if (value.phone !== undefined && typeof value.phone !== "string") return { kind: "invalid" };
  const phone = normalizedString(value.phone) ?? "";
  const message = normalizedMultilineString(value.message);

  if (!submissionId || !UUID_PATTERN.test(submissionId)) return { kind: "invalid" };
  if (!isValidHumanText(firstName, 80) || !isValidHumanText(lastName, 80)) return { kind: "invalid" };
  if (!email || !isValidEmail(email)) return { kind: "invalid" };
  if (!isValidPhone(phone)) return { kind: "invalid" };
  if (!message || message.length > 3_000 || hasUnsafeControlCharacters(message)) return { kind: "invalid" };
  if (value.contactConsent !== true || value.legalConsent !== true || value.legitimateConsent !== true) {
    return { kind: "invalid" };
  }

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
      legitimateConsent: true,
      startedAt,
      website: ""
    }
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

export async function verifyTurnstile(
  payload: TurnstileVerificationPayload,
  request: Request,
  env: ContactEnv
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const allowedHostnames = parseHostnames(env.TURNSTILE_ALLOWED_HOSTNAMES);
  if (!secret || allowedHostnames.length === 0) return false;

  const verificationBody: Record<string, string> = {
    secret,
    response: payload.turnstileToken,
    idempotency_key: payload.submissionId
  };
  const remoteIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (remoteIp && remoteIp.length <= 64 && !hasUnsafeControlCharacters(remoteIp)) {
    verificationBody.remoteip = remoteIp;
  }

  const response = await fetchWithTimeout(
    TURNSTILE_VERIFY_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verificationBody)
    },
    TURNSTILE_TIMEOUT_MS
  );
  if (!response?.ok) return false;

  let result: TurnstileResponse;
  try {
    result = (await response.json()) as TurnstileResponse;
  } catch {
    return false;
  }

  return (
    result.success === true &&
    result.action === CONTACT_ACTION &&
    typeof result.hostname === "string" &&
    allowedHostnames.includes(result.hostname.trim().toLowerCase())
  );
}

export async function createContactTicket(
  submissionId: string,
  env: ContactEnv,
  now = Date.now()
): Promise<string | undefined> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !UUID_PATTERN.test(submissionId)) return undefined;

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
  if (!secret || !UUID_PATTERN.test(submissionId)) return false;

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

export async function sendContactEmails(payload: ContactPayload, env: ContactEnv): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const recipient = env.CONTACT_RECIPIENT_EMAIL?.trim();
  const fromEmail = env.CONTACT_FROM_EMAIL?.trim();
  const replyToEmail = env.CONTACT_REPLY_TO_EMAIL?.trim();
  if (
    !apiKey ||
    !recipient ||
    !isValidEmail(recipient) ||
    !fromEmail ||
    !isValidFromMailbox(fromEmail) ||
    !replyToEmail ||
    !isValidEmail(replyToEmail)
  ) {
    return false;
  }

  const messages = createEmailMessages(payload, recipient, fromEmail, replyToEmail);
  const response = await fetchWithTimeout(
    RESEND_BATCH_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `portfolio-contact/${payload.submissionId}`
      },
      body: JSON.stringify(messages)
    },
    RESEND_TIMEOUT_MS
  );

  return response?.ok === true;
}

export function createEmailMessages(
  payload: ContactPayload,
  recipient: string,
  fromEmail: string,
  replyToEmail: string
): [EmailMessage, EmailMessage] {
  const fullName = `${payload.firstName} ${payload.lastName}`;
  const phone = payload.phone || "Not provided";
  const escapedName = escapeHtml(fullName);
  const escapedEmail = escapeHtml(payload.email);
  const escapedPhone = escapeHtml(phone);
  const escapedMessage = escapeHtml(payload.message).replace(/\n/g, "<br>");

  const ownerText = [
    "New portfolio contact request",
    "",
    `Name: ${fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${phone}`,
    "Acknowledgments: All required acknowledgments accepted.",
    "",
    "Message:",
    payload.message
  ].join("\n");

  const confirmationText = [
    `Hi ${payload.firstName},`,
    "",
    "Thanks for reaching out. Your contact request was received, and I will review it as soon as possible.",
    "",
    "Your request details",
    `Name: ${fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${phone}`,
    "Message:",
    payload.message,
    "",
    `No additional action is required. Please wait for a direct response from me. If you need to add important context, email ${replyToEmail}.`,
    "",
    "This is an automated confirmation. Replies to the sending address are not monitored."
  ].join("\n");

  return [
    {
      from: fromEmail,
      to: [recipient],
      reply_to: payload.email,
      subject: "New portfolio contact request",
      text: ownerText,
      html: emailShell(
        "NEW REQUEST",
        "Portfolio contact request",
        `<p style="margin:0 0 20px;color:#334155;line-height:1.65;">A new professional inquiry was submitted through nicolasmgioanni.dev.</p>${detailTable(
          [
            ["Name", escapedName],
            ["Email", escapedEmail],
            ["Phone", escapedPhone],
            ["Acknowledgments", "All required acknowledgments accepted"]
          ],
          escapedMessage
        )}<p style="margin:20px 0 0;color:#475569;font-size:13px;line-height:1.6;">Reply to this email to respond to ${escapedEmail}.</p>`
      )
    },
    {
      from: fromEmail,
      to: [payload.email],
      reply_to: replyToEmail,
      subject: "Contact request received",
      text: confirmationText,
      html: emailShell(
        "AUTOMATED CONFIRMATION",
        "Contact request received",
        `<p style="margin:0 0 12px;color:#334155;line-height:1.65;">Hi ${escapeHtml(payload.firstName)},</p><p style="margin:0 0 20px;color:#334155;line-height:1.65;">Thanks for reaching out. Your request was received, and I will review it as soon as possible.</p><div style="margin:0 0 20px;padding:12px 14px;border-left:3px solid #234a78;background:#f3f7fb;color:#16304f;font-size:13px;line-height:1.55;"><strong>No additional action is required.</strong> Please wait for a direct response from me.</div>${detailTable(
          [
            ["Name", escapedName],
            ["Email", escapedEmail],
            ["Phone", escapedPhone]
          ],
          escapedMessage
        )}<div style="margin-top:20px;padding:14px;border:1px solid #cbd8e6;border-radius:8px;background:#f7fafc;color:#334155;font-size:13px;line-height:1.6;"><strong style="color:#102a46;">This is an automated email.</strong><br>Replies to the sending address are not monitored. To add important context, email <a href="mailto:${escapeHtml(replyToEmail)}" style="color:#174f87;">${escapeHtml(replyToEmail)}</a>, or wait for my direct response.</div>`
      )
    }
  ];
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
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
      UUID_PATTERN.test(value.submissionId) &&
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

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | undefined {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return undefined;
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, "=");

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return encodeBase64Url(bytes) === value ? bytes : undefined;
  } catch {
    return undefined;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function isValidHumanText(value: string | undefined, maxLength: number): value is string {
  return Boolean(value && value.length <= maxLength && !hasUnsafeControlCharacters(value));
}

function isValidEmail(value: string): boolean {
  if (!value || value.length > 254 || hasUnsafeControlCharacters(value) || /\s/.test(value)) return false;
  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== value.indexOf("@")) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1).toLowerCase();
  if (local.length > 64 || !EMAIL_LOCAL_PATTERN.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (domain.length > 253 || !domain.includes(".")) return false;

  return domain.split(".").every((label) => {
    return Boolean(label && label.length <= 63 && /^[a-z0-9-]+$/.test(label) && !label.startsWith("-") && !label.endsWith("-"));
  });
}

function isValidFromMailbox(value: string): boolean {
  if (!value || value.length > 320 || /[\r\n\t]/.test(value) || hasUnsafeControlCharacters(value)) return false;
  if (isValidEmail(value)) return true;

  const mailboxMatch = /^([^<>]{1,100})\s*<([^<>]+)>$/.exec(value);
  if (!mailboxMatch) return false;

  const displayName = mailboxMatch[1]?.trim() ?? "";
  const address = mailboxMatch[2]?.trim() ?? "";
  return Boolean(displayName && !/[\r\n\t]/.test(displayName) && !hasUnsafeControlCharacters(displayName) && isValidEmail(address));
}

function isValidPhone(value: string): boolean {
  if (!value) return true;
  if (value.length > 40 || hasUnsafeControlCharacters(value) || !PHONE_CHARACTER_PATTERN.test(value)) return false;
  const digitCount = value.replace(/\D/g, "").length;
  return digitCount >= 7 && digitCount <= 20;
}

function hasUnsafeControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 8 || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) || code === 127) {
      return true;
    }
  }
  return false;
}

function parseHostnames(value?: string): string[] {
  const configuredHostnames = (value ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (
    configuredHostnames.length === 0 ||
    configuredHostnames.some((hostname) => !isValidHostname(hostname))
  ) {
    return [];
  }

  return [...new Set(configuredHostnames)];
}

function parseOrigins(value?: string): string[] {
  const configuredOrigins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const normalizedOrigins = configuredOrigins.map(normalizeOrigin);

  if (configuredOrigins.length === 0 || normalizedOrigins.some((origin) => !origin)) return [];
  return [...new Set(normalizedOrigins as string[])];
}

function normalizeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return undefined;
    if (!isValidHostname(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function isValidHostname(value: string): boolean {
  if (!value || value.length > 253) return false;

  return value.split(".").every((label) => {
    return Boolean(
      label &&
        label.length <= 63 &&
        /^[a-z0-9-]+$/.test(label) &&
        !label.startsWith("-") &&
        !label.endsWith("-")
    );
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function detailTable(rows: Array<[string, string]>, escapedMessage: string): string {
  const rowMarkup = rows
    .map(
      ([label, value]) =>
        `<tr><td style="width:34%;padding:10px 12px;border-bottom:1px solid #dbe4ee;color:#64748b;font-size:12px;vertical-align:top;">${label}</td><td style="padding:10px 12px;border-bottom:1px solid #dbe4ee;color:#102a46;font-size:13px;font-weight:600;overflow-wrap:anywhere;">${value}</td></tr>`
    )
    .join("");

  return `<div style="overflow:hidden;border:1px solid #cbd8e6;border-radius:8px;background:#ffffff;"><div style="padding:12px;color:#102a46;font-size:13px;font-weight:700;background:#f7fafc;border-bottom:1px solid #dbe4ee;">Your request details</div><table role="presentation" style="width:100%;border-collapse:collapse;">${rowMarkup}<tr><td colspan="2" style="padding:12px;"><div style="margin-bottom:6px;color:#64748b;font-size:12px;">Message</div><div style="color:#102a46;font-size:13px;line-height:1.6;overflow-wrap:anywhere;">${escapedMessage}</div></td></tr></table></div>`;
}

function emailShell(label: string, title: string, content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" style="width:100%;border-collapse:collapse;background:#eef3f8;"><tr><td style="padding:24px 12px;"><table role="presentation" style="width:100%;max-width:620px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-top:4px solid #173f68;"><tr><td style="padding:30px 28px 12px;"><div style="margin-bottom:8px;color:#456b91;font-size:10px;font-weight:700;letter-spacing:1.4px;">${label}</div><h1 style="margin:0;color:#0b2540;font-size:24px;line-height:1.25;">${title}</h1></td></tr><tr><td style="padding:12px 28px 30px;">${content}</td></tr><tr><td style="padding:14px 28px;background:#0b2540;color:#cbd8e6;font-size:11px;text-align:center;">nicolasmgioanni.dev</td></tr></table></td></tr></table></body></html>`;
}
