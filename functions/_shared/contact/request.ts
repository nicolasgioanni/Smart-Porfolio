import { isAllowedOrigin } from "./config";
import { MAX_REQUEST_BYTES, type ContactEnv, type ReadBodyResult } from "./contracts";
import { awaitWithDeadline, cancelBodyReader, createDeadline } from "./transport";

const REQUEST_BODY_READ_TIMEOUT_MS = 15_000;

export type ContactApiRequest =
  | { kind: "valid"; body: unknown }
  | { kind: "rejected"; response: Response };

export function jsonResponse(status: number, body: Record<string, boolean | string>, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(JSON.stringify(body), { status, headers });
}

export async function readJsonBody(request: Request): Promise<ReadBodyResult> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) return { kind: "invalid" };
    if (parsedLength > MAX_REQUEST_BYTES) return { kind: "too-large" };
  }

  if (!request.body) return { kind: "invalid" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let completed = false;
  const deadline = createDeadline(REQUEST_BODY_READ_TIMEOUT_MS);

  try {
    while (true) {
      const chunk = await awaitWithDeadline(reader.read(), deadline);
      if (!chunk || deadline.isExpired()) return { kind: "invalid" };
      const { done, value } = chunk;
      if (done) break;

      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BYTES) {
        return { kind: "too-large" };
      }
      chunks.push(value);
    }
    completed = true;
  } catch {
    return { kind: "invalid" };
  } finally {
    deadline.clear();
    if (!completed) cancelBodyReader(reader);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { kind: "ok", value: JSON.parse(text) as unknown };
  } catch {
    return { kind: "invalid" };
  }
}

export async function readContactApiRequest(
  request: Request,
  env: ContactEnv,
  isConfigurationValid: () => boolean
): Promise<ContactApiRequest> {
  if (request.method !== "POST") {
    return {
      kind: "rejected",
      response: jsonResponse(405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" })
    };
  }

  if (!isConfigurationValid()) {
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
