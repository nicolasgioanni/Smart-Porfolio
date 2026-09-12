import { hasUnsafeControlCharacters } from "../../../src/lib/contact/validation";
import { parseHostnames } from "./config";
import { CONTACT_ACTION, type ContactEnv, type TurnstileVerificationPayload, type TurnstileVerificationResult } from "./contracts";
import { fetchWithTimeout } from "./transport";
import { isPlainObject } from "./values";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 5_000;
const TURNSTILE_MAX_ATTEMPTS = 2;

interface TurnstileResponse {
  success: boolean;
  hostname?: unknown;
  action?: unknown;
  cdata?: unknown;
  "error-codes"?: unknown;
}

type TurnstileAttemptResult = TurnstileVerificationResult | { kind: "transient" };

export async function verifyTurnstile(
  payload: TurnstileVerificationPayload,
  request: Request,
  env: ContactEnv
): Promise<TurnstileVerificationResult> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const allowedHostnames = parseHostnames(env.TURNSTILE_ALLOWED_HOSTNAMES);
  if (!secret || allowedHostnames.length === 0) return { kind: "unavailable" };

  let operationId: string;
  try {
    operationId = crypto.randomUUID();
  } catch {
    return { kind: "unavailable" };
  }

  const verificationBody: Record<string, string> = {
    secret,
    response: payload.turnstileToken,
    idempotency_key: operationId
  };
  const remoteIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (remoteIp && remoteIp.length <= 64 && !hasUnsafeControlCharacters(remoteIp)) {
    verificationBody.remoteip = remoteIp;
  }

  const requestInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(verificationBody)
  };

  for (let attempt = 0; attempt < TURNSTILE_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchWithTimeout(TURNSTILE_VERIFY_URL, requestInit, TURNSTILE_TIMEOUT_MS);
    const result = await classifyTurnstileAttempt(response, payload.submissionId, allowedHostnames);
    if (result.kind !== "transient") return result;
  }

  return { kind: "unavailable" };
}

async function classifyTurnstileAttempt(
  response: Response | undefined,
  submissionId: string,
  allowedHostnames: string[]
): Promise<TurnstileAttemptResult> {
  if (!response) return { kind: "transient" };
  if (!response.ok) {
    return response.status === 408 || response.status === 429 || response.status >= 500
      ? { kind: "transient" }
      : { kind: "unavailable" };
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    return { kind: "transient" };
  }
  if (!isPlainObject(result) || typeof result.success !== "boolean") return { kind: "transient" };

  const turnstileResult = result as unknown as TurnstileResponse;
  if (turnstileResult.success === true) {
    return turnstileResult.action === CONTACT_ACTION &&
      typeof turnstileResult.hostname === "string" &&
      allowedHostnames.includes(turnstileResult.hostname.trim().toLowerCase()) &&
      turnstileResult.cdata === submissionId
      ? { kind: "valid" }
      : { kind: "rejected" };
  }

  const errorCodes = turnstileResult["error-codes"];
  if (errorCodes !== undefined && (!Array.isArray(errorCodes) || errorCodes.some((code) => typeof code !== "string"))) {
    return { kind: "transient" };
  }

  const codes = errorCodes as string[] | undefined;
  if (codes?.includes("internal-error")) return { kind: "transient" };
  if (codes?.length && codes.every((code) => code === "invalid-input-response" || code === "timeout-or-duplicate")) {
    return { kind: "rejected" };
  }
  return { kind: "unavailable" };
}
