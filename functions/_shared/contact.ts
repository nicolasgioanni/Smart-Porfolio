export const CONTACT_ACTION = "portfolio_contact";
export const MAX_REQUEST_BYTES = 16_384;
export const CONTACT_TICKET_COOKIE_NAME = "__Host-portfolio_contact_ticket";
export const CONTACT_TICKET_MAX_AGE_SECONDS = 30 * 60;

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const DNS_OVER_HTTPS_URL = "https://cloudflare-dns.com/dns-query";
const CANONICAL_SITE_URL = "https://nicolasmgioanni.dev";
const TURNSTILE_TIMEOUT_MS = 5_000;
const RESEND_TIMEOUT_MS = 8_000;
const DNS_TIMEOUT_MS = 3_000;
const MIN_COMPLETION_TIME_MS = 1_200;
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 30_000;
export const CONTACT_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;
export const CONTACT_RATE_LIMIT_MAX_SUBMISSIONS = 2;
const CONTACT_TICKET_VERSION = 1;
const CONTACT_TICKET_MAX_LENGTH = 768;
const CONTACT_TICKET_SIGNATURE_BYTES = 32;
const TICKET_HKDF_SALT = "portfolio-contact-ticket:v1:hkdf-salt";
const TICKET_HKDF_INFO = "portfolio-contact-ticket:v1:hmac-key";
const RATE_LIMIT_HKDF_SALT = "portfolio-contact-rate-limit:v1:hkdf-salt";
const RATE_LIMIT_HKDF_INFO = "portfolio-contact-rate-limit:v1:email-hmac-key";

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
  CONTACT_RATE_LIMIT_DB?: ContactRateLimitDatabase;
}

export interface ContactRateLimitDatabase {
  prepare(query: string): ContactRateLimitPreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: ContactRateLimitPreparedStatement[]
  ): Promise<Array<ContactRateLimitResult<T>>>;
}

export interface ContactRateLimitPreparedStatement {
  bind(...values: unknown[]): ContactRateLimitPreparedStatement;
}

export interface ContactRateLimitResult<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
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

export type EmailDomainValidationResult = { kind: "valid" } | { kind: "invalid" } | { kind: "unavailable" };

export type ContactReservationResult =
  | { kind: "reserved"; reservedAt: number }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | { kind: "mismatch" }
  | { kind: "unavailable" };

interface DnsJsonResponse {
  Status?: number;
  TC?: boolean;
  Answer?: Array<{ type?: number; data?: string }>;
}

type DnsQueryResult = { kind: "ok"; answers: Array<{ type: number; data: string }> } | { kind: "not-found" } | { kind: "unavailable" };

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
      isValidEmail(env.CONTACT_REPLY_TO_EMAIL?.trim() ?? "") &&
      isContactRateLimitDatabase(env.CONTACT_RATE_LIMIT_DB)
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

export async function validateEmailDomain(email: string): Promise<EmailDomainValidationResult> {
  if (!isValidEmail(email)) return { kind: "invalid" };

  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  const mxResult = await queryDns(domain, "MX");
  if (mxResult.kind === "unavailable") return { kind: "unavailable" };
  if (mxResult.kind === "not-found") return { kind: "invalid" };

  const mxAnswers = mxResult.answers.filter((answer) => answer.type === 15);
  if (mxAnswers.length > 0) {
    if (mxAnswers.some((answer) => /^\s*0\s+\.\s*$/.test(answer.data))) return { kind: "invalid" };
    return mxAnswers.some((answer) => /^\s*\d+\s+[^.\s](?:.*[^\s])?\.?\s*$/.test(answer.data))
      ? { kind: "valid" }
      : { kind: "invalid" };
  }

  const [aResult, aaaaResult] = await Promise.all([queryDns(domain, "A"), queryDns(domain, "AAAA")]);
  const hasAddress = [aResult, aaaaResult].some(
    (result) => result.kind === "ok" && result.answers.some((answer) => answer.type === 1 || answer.type === 28)
  );
  if (hasAddress) return { kind: "valid" };
  if (aResult.kind === "unavailable" || aaaaResult.kind === "unavailable") return { kind: "unavailable" };
  return { kind: "invalid" };
}

export async function reserveContactSubmission(
  payload: Pick<ContactPayload, "submissionId" | "email">,
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
  try {
    emailHash = await createRateLimitEmailHash(payload.email, secret);
  } catch {
    return { kind: "unavailable" };
  }

  try {
    const statements = [
      database.prepare("DELETE FROM contact_rate_reservations WHERE expires_at <= ?").bind(nowSeconds),
      database
        .prepare(
          `INSERT INTO contact_rate_reservations (submission_id, email_hash, reserved_at, expires_at)
           SELECT ?1, ?2, ?3, ?4
           WHERE NOT EXISTS (
             SELECT 1 FROM contact_rate_reservations
             WHERE submission_id = ?1 AND email_hash <> ?2
           )
           AND (
             EXISTS (
               SELECT 1 FROM contact_rate_reservations
               WHERE submission_id = ?1 AND email_hash = ?2
             )
             OR (
               SELECT COUNT(*) FROM contact_rate_reservations
               WHERE email_hash = ?2 AND expires_at > ?3
             ) < ${CONTACT_RATE_LIMIT_MAX_SUBMISSIONS}
           )
           ON CONFLICT(submission_id) DO NOTHING`
        )
        .bind(payload.submissionId, emailHash, nowSeconds, expiresAt),
      database
        .prepare(
          "SELECT email_hash, reserved_at, expires_at FROM contact_rate_reservations WHERE submission_id = ? LIMIT 1"
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
      if (reservation.email_hash !== emailHash) return { kind: "mismatch" };
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

export async function sendContactEmails(
  payload: ContactPayload,
  env: ContactEnv,
  reservationTimestamp = Math.floor(Date.now() / 1_000)
): Promise<boolean> {
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

  const reservationYear = new Date(reservationTimestamp * 1_000).getUTCFullYear();
  if (!Number.isSafeInteger(reservationYear)) return false;

  const [visitorMessage, ownerMessage] = createEmailMessages(
    payload,
    recipient,
    fromEmail,
    replyToEmail,
    reservationYear
  );
  const visitorAccepted = await sendResendEmail(
    visitorMessage,
    apiKey,
    `portfolio-contact/visitor/${payload.submissionId}`
  );
  if (!visitorAccepted) return false;

  return sendResendEmail(ownerMessage, apiKey, `portfolio-contact/owner/${payload.submissionId}`);
}

export function createEmailMessages(
  payload: ContactPayload,
  recipient: string,
  fromEmail: string,
  replyToEmail: string,
  reservationYear = new Date().getUTCFullYear()
): [EmailMessage, EmailMessage] {
  const fullName = `${payload.firstName} ${payload.lastName}`;
  const phone = payload.phone || "Not provided";
  const escapedName = escapeHtml(fullName);
  const escapedEmail = escapeHtml(payload.email);
  const escapedPhone = escapeHtml(phone);
  const escapedMessage = escapeHtml(payload.message).replace(/\n/g, "<br>");

  const ownerText = [
    `New contact request from ${fullName}`,
    "",
    `Name: ${fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${phone}`,
    "",
    "Message:",
    payload.message
  ].join("\n");

  const confirmationText = [
    `Hi ${payload.firstName},`,
    "",
    "Thank you for reaching out. I received your message and will get back to you as soon as I can.",
    "",
    "Information you submitted",
    `Name: ${fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${phone}`,
    "Message:",
    payload.message,
    "",
    `If you need to correct or update this information, please submit a new form at ${CANONICAL_SITE_URL}/contact or email ${replyToEmail}.`,
    "",
    "This is an automated confirmation. Replies are directed to the email address above.",
    "",
    `Privacy Notice: ${CANONICAL_SITE_URL}/privacy`,
    `Site Terms & Accuracy Notice: ${CANONICAL_SITE_URL}/terms`,
    `© ${reservationYear} Nicolas Gioanni. All rights reserved.`
  ].join("\n");

  return [
    {
      from: fromEmail,
      to: [payload.email],
      reply_to: replyToEmail,
      subject: "I received your message!",
      text: confirmationText,
      html: emailShell(
        "MESSAGE CONFIRMATION",
        "I received your message!",
        `<p style="margin:0 0 12px;color:#334155;line-height:1.65;">Hi ${escapeHtml(payload.firstName)},</p><p style="margin:0 0 20px;color:#334155;line-height:1.65;">Thank you for reaching out. I received your message and will get back to you as soon as I can.</p>${detailTable(
          "Information you submitted",
          [
            ["Name", escapedName],
            ["Email", escapedEmail],
            ["Phone", escapedPhone]
          ],
          escapedMessage
        )}<div style="margin-top:20px;padding:14px;border:1px solid #cbd8e6;border-radius:8px;background:#f7fafc;color:#334155;font-size:13px;line-height:1.6;">If you need to correct or update this information, please <a href="${CANONICAL_SITE_URL}/contact" style="color:#174f87;font-weight:600;">submit a new form</a> or email <a href="mailto:${escapeHtml(replyToEmail)}" style="color:#174f87;font-weight:600;">${escapeHtml(replyToEmail)}</a>.</div>`,
        visitorLegalFooter(reservationYear)
      )
    },
    {
      from: fromEmail,
      to: [recipient],
      reply_to: payload.email,
      subject: `New contact request from ${fullName}`,
      text: ownerText,
      html: emailShell(
        "NEW CONTACT REQUEST",
        escapedName,
        `<p style="margin:0 0 20px;color:#334155;line-height:1.65;">A new message was submitted through nicolasmgioanni.dev.</p>${detailTable(
          "Contact information",
          [
            ["Name", escapedName],
            [
              "Email",
              `<a href="mailto:${escapedEmail}" style="color:#174f87;font-weight:700;">${escapedEmail}</a>`
            ],
            ["Phone", escapedPhone]
          ],
          escapedMessage
        )}<p style="margin:20px 0 0;color:#475569;font-size:13px;line-height:1.6;">Reply directly to this email to contact ${escapedName}.</p>`
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
  return Boolean(value && value.length <= maxLength && !/[\r\n\t]/.test(value) && !hasUnsafeControlCharacters(value));
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

async function queryDns(domain: string, recordType: "MX" | "A" | "AAAA"): Promise<DnsQueryResult> {
  const response = await fetchWithTimeout(
    `${DNS_OVER_HTTPS_URL}?name=${encodeURIComponent(domain)}&type=${recordType}`,
    { headers: { Accept: "application/dns-json" } },
    DNS_TIMEOUT_MS
  );
  if (!response?.ok) return { kind: "unavailable" };

  let body: DnsJsonResponse;
  try {
    body = (await response.json()) as DnsJsonResponse;
  } catch {
    return { kind: "unavailable" };
  }
  if (!isPlainObject(body) || !Number.isInteger(body.Status)) return { kind: "unavailable" };
  if (body.TC === true || (body.TC !== undefined && typeof body.TC !== "boolean")) {
    return { kind: "unavailable" };
  }
  if (body.Status === 3) return { kind: "not-found" };
  if (body.Status !== 0) return { kind: "unavailable" };
  if (body.Answer !== undefined && !Array.isArray(body.Answer)) return { kind: "unavailable" };

  const answers: Array<{ type: number; data: string }> = [];
  for (const answer of body.Answer ?? []) {
    if (!isPlainObject(answer)) return { kind: "unavailable" };
    const type = answer.type;
    const data = answer.data;
    if (typeof type !== "number" || !Number.isInteger(type) || typeof data !== "string") {
      return { kind: "unavailable" };
    }
    answers.push({ type, data });
  }
  return { kind: "ok", answers };
}

async function sendResendEmail(message: EmailMessage, apiKey: string, idempotencyKey: string): Promise<boolean> {
  const response = await fetchWithTimeout(
    RESEND_EMAIL_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(message)
    },
    RESEND_TIMEOUT_MS
  );
  return response?.ok === true;
}

function detailTable(title: string, rows: Array<[string, string]>, escapedMessage: string): string {
  const rowMarkup = rows
    .map(
      ([label, value]) =>
        `<tr><td style="width:34%;padding:10px 12px;border-bottom:1px solid #dbe4ee;color:#64748b;font-size:12px;vertical-align:top;">${label}</td><td style="padding:10px 12px;border-bottom:1px solid #dbe4ee;color:#102a46;font-size:13px;font-weight:600;overflow-wrap:anywhere;">${value}</td></tr>`
    )
    .join("");

  return `<div style="overflow:hidden;border:1px solid #cbd8e6;border-radius:8px;background:#ffffff;"><div style="padding:12px;color:#102a46;font-size:13px;font-weight:700;background:#f7fafc;border-bottom:1px solid #dbe4ee;">${title}</div><table role="presentation" style="width:100%;border-collapse:collapse;">${rowMarkup}<tr><td colspan="2" style="padding:12px;"><div style="margin-bottom:6px;color:#64748b;font-size:12px;">Message</div><div style="color:#102a46;font-size:13px;line-height:1.6;overflow-wrap:anywhere;">${escapedMessage}</div></td></tr></table></div>`;
}

function visitorLegalFooter(reservationYear: number): string {
  return `<a href="${CANONICAL_SITE_URL}/privacy" style="color:#dbe8f5;text-decoration:underline;">Privacy Notice</a><span style="padding:0 8px;color:#7995b2;">|</span><a href="${CANONICAL_SITE_URL}/terms" style="color:#dbe8f5;text-decoration:underline;">Site Terms &amp; Accuracy Notice</a><div style="margin-top:8px;">© ${reservationYear} Nicolas Gioanni. All rights reserved.</div>`;
}

function emailShell(label: string, title: string, content: string, footer = "nicolasmgioanni.dev"): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" style="width:100%;border-collapse:collapse;background:#eef3f8;"><tr><td style="padding:24px 12px;"><table role="presentation" style="width:100%;max-width:620px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-top:4px solid #173f68;"><tr><td style="padding:30px 28px 12px;"><div style="margin-bottom:8px;color:#456b91;font-size:10px;font-weight:700;letter-spacing:1.4px;">${label}</div><h1 style="margin:0;color:#0b2540;font-size:24px;line-height:1.25;">${title}</h1></td></tr><tr><td style="padding:12px 28px 30px;">${content}</td></tr><tr><td style="padding:18px 28px;background:#0b2540;color:#cbd8e6;font-size:11px;line-height:1.5;text-align:center;">${footer}</td></tr></table></td></tr></table></body></html>`;
}
