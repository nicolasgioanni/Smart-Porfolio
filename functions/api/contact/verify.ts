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
import { createDeadline } from "../../_shared/contact/transport";

const CONTACT_VERIFICATION_TIMEOUT_MS = 25_000;

interface PagesContext<Env> {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext<ContactEnv>): Promise<Response> {
  const { request, env } = context;
  const operationDeadline = createDeadline(CONTACT_VERIFICATION_TIMEOUT_MS);
  try {
    const parsedRequest = await readContactApiRequest(
      request,
      env,
      () => hasRequiredTurnstileConfiguration(env),
      operationDeadline
    );
    if (parsedRequest.kind === "rejected") return parsedRequest.response;

    const parsed = parseTurnstileVerificationPayload(parsedRequest.body);
    if (parsed.kind === "invalid") return jsonResponse(400, { ok: false, error: "invalid_request" });

    const verification = await verifyTurnstile(parsed.payload, request, env, operationDeadline);
    if (verification.kind === "unavailable") return jsonResponse(503, { ok: false, error: "verification_unavailable" });
    if (verification.kind === "rejected") return jsonResponse(400, { ok: false, error: "verification_failed" });
    if (operationDeadline.isExpired()) return jsonResponse(503, { ok: false, error: "verification_unavailable" });

    const ticket = await createContactTicket(parsed.payload.submissionId, env, Date.now(), operationDeadline);
    if (!ticket || operationDeadline.isExpired()) return jsonResponse(503, { ok: false, error: "service_unavailable" });

    return jsonResponse(200, { ok: true }, { "Set-Cookie": serializeContactTicketCookie(ticket) });
  } finally {
    operationDeadline.clear();
  }
}
