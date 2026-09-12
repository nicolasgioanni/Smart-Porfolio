import {
  createContactTicket,
  hasRequiredTurnstileConfiguration,
  jsonResponse,
  parseTurnstileVerificationPayload,
  serializeContactTicketCookie,
  type ContactEnv,
  verifyTurnstile
} from "../../_shared/contact";
import { readContactApiRequest } from "../../_shared/contact";

interface PagesContext<Env> {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext<ContactEnv>): Promise<Response> {
  const { request, env } = context;

  const parsedRequest = await readContactApiRequest(request, env, () => hasRequiredTurnstileConfiguration(env));
  if (parsedRequest.kind === "rejected") return parsedRequest.response;

  const parsed = parseTurnstileVerificationPayload(parsedRequest.body);
  if (parsed.kind === "invalid") {
    return jsonResponse(400, { ok: false, error: "invalid_request" });
  }

  const verification = await verifyTurnstile(parsed.payload, request, env);
  if (verification.kind === "unavailable") {
    return jsonResponse(503, { ok: false, error: "verification_unavailable" });
  }
  if (verification.kind === "rejected") {
    return jsonResponse(400, { ok: false, error: "verification_failed" });
  }

  const ticket = await createContactTicket(parsed.payload.submissionId, env);
  if (!ticket) {
    return jsonResponse(503, { ok: false, error: "service_unavailable" });
  }

  return jsonResponse(200, { ok: true }, { "Set-Cookie": serializeContactTicketCookie(ticket) });
}
