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

interface PagesContext<Env> {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext<ContactEnv>): Promise<Response> {
  const { request, env } = context;

  const parsedRequest = await readContactApiRequest(request, env, hasRequiredDeliveryConfiguration(env));
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

  if (!(await hasValidContactTicket(request, parsed.payload.submissionId, env))) {
    return jsonResponse(401, { ok: false, error: "verification_required" });
  }

  const domainValidation = await validateEmailDomain(parsed.payload.email);
  if (domainValidation.kind === "invalid") {
    return jsonResponse(422, { ok: false, error: "invalid_email" });
  }
  if (domainValidation.kind === "unavailable") {
    return jsonResponse(503, { ok: false, error: "email_validation_unavailable" });
  }

  const reservation = await reserveContactSubmission(parsed.payload, env);
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

  const delivered = await sendContactEmails(parsed.payload, env, reservation.reservedAt);
  if (!delivered) {
    return jsonResponse(502, { ok: false, error: "delivery_failed" });
  }

  return jsonResponse(200, { ok: true }, { "Set-Cookie": serializeClearedContactTicketCookie() });
}
