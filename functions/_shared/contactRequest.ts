import {
  isAllowedOrigin,
  jsonResponse,
  readJsonBody,
  type ContactEnv
} from "./contact";

export type ContactApiRequest =
  | { kind: "valid"; body: unknown }
  | { kind: "rejected"; response: Response };

/**
 * Applies the common public API boundary before an endpoint interprets its
 * endpoint-specific JSON shape. The handlers still own configuration and
 * payload semantics, which keeps their different trust contracts explicit.
 */
export async function readContactApiRequest(
  request: Request,
  env: ContactEnv,
  configurationIsValid: boolean
): Promise<ContactApiRequest> {
  if (request.method !== "POST") {
    return {
      kind: "rejected",
      response: jsonResponse(405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" })
    };
  }

  if (!configurationIsValid) {
    return { kind: "rejected", response: jsonResponse(503, { ok: false, error: "service_unavailable" }) };
  }

  if (!isAllowedOrigin(request, env.CONTACT_ALLOWED_ORIGINS)) {
    return { kind: "rejected", response: jsonResponse(403, { ok: false, error: "request_rejected" }) };
  }

  const mediaType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { kind: "rejected", response: jsonResponse(415, { ok: false, error: "unsupported_media_type" }) };
  }

  const body = await readJsonBody(request);
  if (body.kind === "too-large") {
    return { kind: "rejected", response: jsonResponse(413, { ok: false, error: "request_too_large" }) };
  }
  if (body.kind === "invalid") {
    return { kind: "rejected", response: jsonResponse(400, { ok: false, error: "invalid_request" }) };
  }

  return { kind: "valid", body: body.value };
}
