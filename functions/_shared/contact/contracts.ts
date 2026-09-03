export const CONTACT_ACTION = "portfolio_contact";
export const MAX_REQUEST_BYTES = 16_384;
export const CONTACT_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;
export const CONTACT_RATE_LIMIT_MAX_SUBMISSIONS = 2;
export const CONTACT_RESERVATION_INSERT_SQL = `INSERT INTO contact_rate_reservations (submission_id, email_hash, payload_hash, reserved_at, expires_at)
  SELECT ?1, ?2, ?3, ?4, ?5
  WHERE NOT EXISTS (
    SELECT 1 FROM contact_rate_reservations
    WHERE submission_id = ?1
      AND (email_hash <> ?2 OR payload_hash IS NULL OR payload_hash <> ?3)
  )
  AND (
    EXISTS (
      SELECT 1 FROM contact_rate_reservations
      WHERE submission_id = ?1 AND email_hash = ?2 AND payload_hash = ?3
    )
    OR (
      SELECT COUNT(*) FROM contact_rate_reservations
      WHERE email_hash = ?2 AND expires_at > ?4
    ) < ${CONTACT_RATE_LIMIT_MAX_SUBMISSIONS}
  )
  ON CONFLICT(submission_id) DO NOTHING`;

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
  startedAt: number;
  website: string;
}

export interface TurnstileVerificationPayload {
  submissionId: string;
  turnstileToken: string;
}

export type PayloadResult =
  | { kind: "valid"; payload: ContactPayload }
  | { kind: "spam" }
  | { kind: "expired" }
  | { kind: "invalid" };

export type TurnstileVerificationPayloadResult =
  | { kind: "valid"; payload: TurnstileVerificationPayload }
  | { kind: "invalid" };

export type ReadBodyResult =
  | { kind: "ok"; value: unknown }
  | { kind: "invalid" }
  | { kind: "too-large" };

export type TurnstileVerificationResult =
  | { kind: "valid" }
  | { kind: "rejected" }
  | { kind: "unavailable" };

export type EmailDomainValidationResult = { kind: "valid" } | { kind: "invalid" } | { kind: "unavailable" };

export type ContactReservationResult =
  | { kind: "reserved"; reservedAt: number }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | { kind: "mismatch" }
  | { kind: "unavailable" };

export interface EmailMessage {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  html: string;
  text: string;
}
