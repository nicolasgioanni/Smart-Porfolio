import { hasUnsafeControlCharacters, isValidEmail } from "../../../src/lib/contact/validation";
import type { ContactEnv } from "./contracts";
import { isPlainObject } from "./values";

export function hasRequiredTurnstileConfiguration(env: ContactEnv): boolean {
  return Boolean(
    env.TURNSTILE_SECRET_KEY?.trim() &&
      parseHostnames(env.TURNSTILE_ALLOWED_HOSTNAMES).length > 0 &&
      parseOrigins(env.CONTACT_ALLOWED_ORIGINS).length > 0
  );
}

export function hasRequiredDeliveryConfiguration(env: ContactEnv): boolean {
  return Boolean(
    env.TURNSTILE_SECRET_KEY?.trim() &&
      parseOrigins(env.CONTACT_ALLOWED_ORIGINS).length > 0 &&
      env.RESEND_API_KEY?.trim() &&
      isValidEmail(env.CONTACT_RECIPIENT_EMAIL?.trim() ?? "") &&
      isValidFromMailbox(env.CONTACT_FROM_EMAIL?.trim() ?? "") &&
      isValidEmail(env.CONTACT_REPLY_TO_EMAIL?.trim() ?? "") &&
      isContactRateLimitDatabase(env.CONTACT_RATE_LIMIT_DB)
  );
}

export function isAllowedOrigin(request: Request, configuredOrigins?: string): boolean {
  const rawOrigin = request.headers.get("Origin");
  if (!rawOrigin || rawOrigin === "null") return false;

  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return false;

  const allowedOrigins = parseOrigins(configuredOrigins);
  if (allowedOrigins.length === 0) return false;
  return allowedOrigins.includes(origin);
}

export function parseHostnames(value?: string): string[] {
  const configuredHostnames = (value ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (
    configuredHostnames.length === 0 ||
    configuredHostnames.some((hostname) => !isValidHostname(hostname))
  ) {
    return [];
  }

  return [...new Set(configuredHostnames)];
}

function isContactRateLimitDatabase(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return typeof value.prepare === "function" && typeof value.batch === "function";
}

export function isValidFromMailbox(value: string): boolean {
  if (!value || value.length > 320 || /[\r\n\t]/.test(value) || hasUnsafeControlCharacters(value)) return false;
  if (isValidEmail(value)) return true;

  const mailboxMatch = /^([^<>]{1,100})\s*<([^<>]+)>$/.exec(value);
  if (!mailboxMatch) return false;

  const displayName = mailboxMatch[1]?.trim() ?? "";
  const address = mailboxMatch[2]?.trim() ?? "";
  return Boolean(displayName && !/[\r\n\t]/.test(displayName) && !hasUnsafeControlCharacters(displayName) && isValidEmail(address));
}

function parseOrigins(value?: string): string[] {
  const configuredOrigins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const normalizedOrigins = configuredOrigins.map(normalizeOrigin);

  if (configuredOrigins.length === 0 || normalizedOrigins.some((origin) => !origin)) return [];
  return [...new Set(normalizedOrigins as string[])];
}

function normalizeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return undefined;
    if (!isValidHostname(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function isValidHostname(value: string): boolean {
  if (!value || value.length > 253) return false;

  return value.split(".").every((label) => {
    return Boolean(
      label &&
        label.length <= 63 &&
        /^[a-z0-9-]+$/.test(label) &&
        !label.startsWith("-") &&
        !label.endsWith("-")
    );
  });
}
