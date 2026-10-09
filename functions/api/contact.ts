import {
  hasRequiredDeliveryConfiguration,
  hasValidContactTicket,
  jsonResponse,
  parseContactPayload,
  reserveContactSubmission,
  sendContactEmails,
  serializeClearedContactTicketCookie,
  validateEmailDomain,
  type ContactEnv
} from "../_shared/contact";
import { readContactApiRequest } from "../_shared/contact";
import { createDeadline } from "../_shared/contact/transport";

const DELIVERY_OPERATION_TIMEOUT_MS = 20_000;

interface PagesContext<Env> {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext<ContactEnv>): Promise<Response> {
  const { request, env } = context;
  const deadline = createDeadline(DELIVERY_OPERATION_TIMEOUT_MS);
  try {

  const parsedRequest = await readContactApiRequest(request, env, () => hasRequiredDeliveryConfiguration(env), deadline);
  if (parsedRequest.kind === "rejected") return parsedRequest.response;

  const parsed = parseContactPayload(parsedRequest.body);
  if (parsed.kind === "spam") {
    return jsonResponse(200, { ok: true });
  }
  if (parsed.kind === "expired") {
    return jsonResponse(409, { ok: false, error: "request_expired" });
  }
  if (parsed.kind === "invalid") {
    return jsonResponse(400, { ok: false, error: "invalid_request" });
  }

  if (deadline.isExpired() || !(await hasValidContactTicket(request, parsed.payload.submissionId, env, Date.now(), deadline))) {
    return jsonResponse(401, { ok: false, error: "verification_required" });
  }

  const domainValidation = await validateEmailDomain(parsed.payload.email, deadline);
  if (domainValidation.kind === "invalid") {
    return jsonResponse(422, { ok: false, error: "invalid_email" });
  }
  if (domainValidation.kind === "unavailable") {
    return jsonResponse(503, { ok: false, error: "email_validation_unavailable" });
  }

  if (deadline.isExpired()) return jsonResponse(503, { ok: false, error: "service_unavailable" });
  const reservation = await reserveContactSubmission(parsed.payload, env, Date.now(), deadline);
  if (reservation.kind === "unavailable") {
    return jsonResponse(503, { ok: false, error: "service_unavailable" });
  }
  if (reservation.kind === "mismatch") {
    return jsonResponse(400, { ok: false, error: "invalid_request" });
  }
  if (reservation.kind === "rate-limited") {
    return jsonResponse(
      429,
      { ok: false, error: "rate_limited" },
      { "Retry-After": String(reservation.retryAfterSeconds) }
    );
  }

  if (deadline.isExpired()) return jsonResponse(502, { ok: false, error: "delivery_failed" });
  const delivered = await sendContactEmails(parsed.payload, env, reservation.reservedAt, deadline);
  if (!delivered) {
    return jsonResponse(502, { ok: false, error: "delivery_failed" });
  }

  return jsonResponse(200, { ok: true }, { "Set-Cookie": serializeClearedContactTicketCookie() });
  } finally {
    deadline.clear();
  }
}
