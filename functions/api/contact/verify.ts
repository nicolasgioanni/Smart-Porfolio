import {
  createContactTicket,
  hasRequiredTurnstileConfiguration,
  isAllowedOrigin,
  jsonResponse,
  parseTurnstileVerificationPayload,
  readJsonBody,
  serializeContactTicketCookie,
  type ContactEnv,
  verifyTurnstile
} from "../../_shared/contact";

interface PagesContext<Env> {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext<ContactEnv>): Promise<Response> {
  const { request, env } = context;

  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" });
  }

  if (!hasRequiredTurnstileConfiguration(env)) {
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

  const parsed = parseTurnstileVerificationPayload(body.value);
  if (parsed.kind === "invalid") {
    return jsonResponse(400, { ok: false, error: "invalid_request" });
  }

  if (!(await verifyTurnstile(parsed.payload, request, env))) {
    return jsonResponse(400, { ok: false, error: "verification_failed" });
  }

  const ticket = await createContactTicket(parsed.payload.submissionId, env);
  if (!ticket) {
    return jsonResponse(503, { ok: false, error: "service_unavailable" });
  }

  return jsonResponse(200, { ok: true }, { "Set-Cookie": serializeContactTicketCookie(ticket) });
}
