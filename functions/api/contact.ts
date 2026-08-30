import {
  hasRequiredDeliveryConfiguration,
  hasValidContactTicket,
  isAllowedOrigin,
  jsonResponse,
  parseContactPayload,
  readJsonBody,
  reserveContactSubmission,
  sendContactEmails,
  serializeClearedContactTicketCookie,
  validateEmailDomain,
  type ContactEnv
} from "../_shared/contact";

interface PagesContext<Env> {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext<ContactEnv>): Promise<Response> {
  const { request, env } = context;

  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" });
  }

  if (!hasRequiredDeliveryConfiguration(env)) {
    return jsonResponse(503, { ok: false, error: "service_unavailable" });
  }

  if (!isAllowedOrigin(request, env.CONTACT_ALLOWED_ORIGINS)) {
    return jsonResponse(403, { ok: false, error: "request_rejected" });
  }

  const mediaType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return jsonResponse(415, { ok: false, error: "unsupported_media_type" });
  }

  const body = await readJsonBody(request);
  if (body.kind === "too-large") {
    return jsonResponse(413, { ok: false, error: "request_too_large" });
  }
  if (body.kind === "invalid") {
    return jsonResponse(400, { ok: false, error: "invalid_request" });
  }

  const parsed = parseContactPayload(body.value);
  if (parsed.kind === "spam") {
    return jsonResponse(200, { ok: true });
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
