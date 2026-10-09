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

const VERIFY_OPERATION_TIMEOUT_MS = 12_000;

interface PagesContext<Env> {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext<ContactEnv>): Promise<Response> {
  const { request, env } = context;
  const deadline = createDeadline(VERIFY_OPERATION_TIMEOUT_MS);
  try {

  const parsedRequest = await readContactApiRequest(request, env, () => hasRequiredTurnstileConfiguration(env), deadline);
  if (parsedRequest.kind === "rejected") return parsedRequest.response;

  const parsed = parseTurnstileVerificationPayload(parsedRequest.body);
  if (parsed.kind === "invalid") {
    return jsonResponse(400, { ok: false, error: "invalid_request" });
  }

  if (deadline.isExpired()) return jsonResponse(503, { ok: false, error: "verification_unavailable" });
  const verification = await verifyTurnstile(parsed.payload, request, env, deadline);
  if (verification.kind === "unavailable") {
    return jsonResponse(503, { ok: false, error: "verification_unavailable" });
  }
  if (verification.kind === "rejected") {
    return jsonResponse(400, { ok: false, error: "verification_failed" });
  }

  const ticket = await createContactTicket(parsed.payload.submissionId, env, Date.now(), deadline);
  if (!ticket || deadline.isExpired()) {
    return jsonResponse(503, { ok: false, error: "service_unavailable" });
  }

  return jsonResponse(200, { ok: true }, { "Set-Cookie": serializeContactTicketCookie(ticket) });
  } finally {
    deadline.clear();
  }
}
