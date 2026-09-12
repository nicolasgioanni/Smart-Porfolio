/**
 * Stable public contact boundary for Pages Function handlers and their tests.
 * Runtime domains live under `contact/` so provider, persistence, and delivery
 * dependencies stay independently reviewable without widening this contract.
 */
export {
  hasRequiredDeliveryConfiguration,
  hasRequiredTurnstileConfiguration,
  isAllowedOrigin
} from "./contact/config";
export {
  CONTACT_ACTION,
  CONTACT_RATE_LIMIT_MAX_SUBMISSIONS,
  CONTACT_RATE_LIMIT_WINDOW_SECONDS,
  CONTACT_RESERVATION_INSERT_SQL,
  MAX_REQUEST_BYTES,
  type ContactEnv,
  type ContactPayload,
  type ContactRateLimitDatabase,
  type ContactRateLimitPreparedStatement,
  type ContactRateLimitResult,
  type ContactReservationResult,
  type EmailDomainValidationResult,
  type TurnstileVerificationPayload,
  type TurnstileVerificationResult
} from "./contact/contracts";
export { createEmailMessages, escapeHtml, sendContactEmails } from "./contact/delivery";
export { validateEmailDomain } from "./contact/dns";
export { parseContactPayload, parseTurnstileVerificationPayload } from "./contact/payload";
export { jsonResponse, readContactApiRequest, readJsonBody, type ContactApiRequest } from "./contact/request";
export { reserveContactSubmission } from "./contact/reservation";
export {
  CONTACT_TICKET_COOKIE_NAME,
  CONTACT_TICKET_MAX_AGE_SECONDS,
  createContactTicket,
  hasValidContactTicket,
  serializeClearedContactTicketCookie,
  serializeContactTicketCookie
} from "./contact/ticket";
export { verifyTurnstile } from "./contact/turnstile";
