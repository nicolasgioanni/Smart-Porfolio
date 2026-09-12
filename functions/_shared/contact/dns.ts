import { isValidEmail } from "../../../src/lib/contact/validation";
import type { EmailDomainValidationResult } from "./contracts";
import { fetchWithJsonTimeout, type ReadJsonResponse } from "./transport";
import { isPlainObject } from "./values";

const DNS_OVER_HTTPS_URL = "https://cloudflare-dns.com/dns-query";
const DNS_TIMEOUT_MS = 3_000;
const DNS_MAX_RESPONSE_BYTES = 65_536;

interface DnsJsonResponse {
  Status?: number;
  TC?: boolean;
  Answer?: Array<{ type?: number; data?: string }>;
}

type DnsQueryResult = { kind: "ok"; answers: Array<{ type: number; data: string }> } | { kind: "not-found" } | { kind: "unavailable" };

export async function validateEmailDomain(email: string): Promise<EmailDomainValidationResult> {
  if (!isValidEmail(email)) return { kind: "invalid" };

  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  const mxResult = await queryDns(domain, "MX");
  if (mxResult.kind === "unavailable") return { kind: "unavailable" };
  if (mxResult.kind === "not-found") return { kind: "invalid" };

  const mxAnswers = mxResult.answers.filter((answer) => answer.type === 15);
  if (mxAnswers.length > 0) {
    if (mxAnswers.some((answer) => /^\s*0\s+\.\s*$/.test(answer.data))) return { kind: "invalid" };
    return mxAnswers.some((answer) => /^\s*\d+\s+[^.\s](?:.*[^\s])?\.?\s*$/.test(answer.data))
      ? { kind: "valid" }
      : { kind: "invalid" };
  }

  const [aResult, aaaaResult] = await Promise.all([queryDns(domain, "A"), queryDns(domain, "AAAA")]);
  const hasAddress = [aResult, aaaaResult].some(
    (result) => result.kind === "ok" && result.answers.some((answer) => answer.type === 1 || answer.type === 28)
  );
  if (hasAddress) return { kind: "valid" };
  if (aResult.kind === "unavailable" || aaaaResult.kind === "unavailable") return { kind: "unavailable" };
  return { kind: "invalid" };
}

async function queryDns(domain: string, recordType: "MX" | "A" | "AAAA"): Promise<DnsQueryResult> {
  return (
    (await fetchWithJsonTimeout(
      `${DNS_OVER_HTTPS_URL}?name=${encodeURIComponent(domain)}&type=${recordType}`,
      { headers: { Accept: "application/dns-json" } },
      DNS_TIMEOUT_MS,
      DNS_MAX_RESPONSE_BYTES,
      parseDnsResponse
    )) ?? { kind: "unavailable" }
  );
}

async function parseDnsResponse(response: Response, readJson: ReadJsonResponse): Promise<DnsQueryResult> {
  if (!response.ok) return { kind: "unavailable" };

  const body = (await readJson()) as DnsJsonResponse | undefined;
  if (!isPlainObject(body) || !Number.isInteger(body.Status)) return { kind: "unavailable" };
  if (body.TC === true || (body.TC !== undefined && typeof body.TC !== "boolean")) {
    return { kind: "unavailable" };
  }
  if (body.Status === 3) return { kind: "not-found" };
  if (body.Status !== 0) return { kind: "unavailable" };
  if (body.Answer !== undefined && !Array.isArray(body.Answer)) return { kind: "unavailable" };

  const answers: Array<{ type: number; data: string }> = [];
  for (const answer of body.Answer ?? []) {
    if (!isPlainObject(answer)) return { kind: "unavailable" };
    const type = answer.type;
    const data = answer.data;
    if (typeof type !== "number" || !Number.isInteger(type) || typeof data !== "string") {
      return { kind: "unavailable" };
    }
    answers.push({ type, data });
  }
  return { kind: "ok", answers };
}
