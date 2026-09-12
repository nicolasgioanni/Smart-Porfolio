import { contactTopLevelDomains } from "./ianaTlds";

/**
 * Environment-independent validation shared by the progressively enhanced
 * contact form and its server-side delivery boundary. Client validation is
 * only usability feedback; the Pages Functions independently enforce it.
 */
export const contactFieldLimits = {
  firstName: 80,
  lastName: 80,
  email: 254,
  phone: 40,
  message: 500
} as const;

const emailLocalPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const emailAsciiTldPattern = /^[a-z]{2,63}$/;
const emailPunycodeTldPattern = /^xn--[a-z0-9](?:[a-z0-9-]{0,57}[a-z0-9])$/;
const phonePattern = /^[0-9A-Za-z+().,\-\s/#*]+$/;

export function hasUnsafeControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 8 || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) || code === 127) {
      return true;
    }
  }
  return false;
}

export function isValidEmail(value: string): boolean {
  return getEmailValidationIssue(value) === undefined;
}

export function getEmailValidationIssue(value: string): "format" | "domain-ending" | undefined {
  if (!hasValidEmailSyntax(value)) return "format";
  const topLevelDomain = value.slice(value.lastIndexOf(".") + 1).toLowerCase();
  return contactTopLevelDomains.has(topLevelDomain) ? undefined : "domain-ending";
}

function hasValidEmailSyntax(value: string): boolean {
  if (!value || value.length > contactFieldLimits.email || hasUnsafeControlCharacters(value) || /\s/.test(value)) {
    return false;
  }

  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== value.indexOf("@")) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1).toLowerCase();
  if (local.length > 64 || !emailLocalPattern.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (domain.length > 253 || !domain.includes(".")) return false;

  const labels = domain.split(".");
  if (
    !labels.every(
      (label) => label && label.length <= 63 && /^[a-z0-9-]+$/.test(label) && !label.startsWith("-") && !label.endsWith("-")
    )
  ) {
    return false;
  }

  const topLevelDomain = labels.at(-1) ?? "";
  if (emailAsciiTldPattern.test(topLevelDomain)) return true;
  if (!emailPunycodeTldPattern.test(topLevelDomain)) return false;

  try {
    return new URL(`https://${topLevelDomain}`).hostname === topLevelDomain;
  } catch {
    return false;
  }
}

export function isValidPhone(value: string): boolean {
  if (!value) return true;
  if (value.length > contactFieldLimits.phone || hasUnsafeControlCharacters(value) || !phonePattern.test(value)) {
    return false;
  }
  const digitCount = value.replace(/\D/g, "").length;
  return digitCount >= 7 && digitCount <= 20;
}

export function isValidHumanText(value: string | undefined, maxLength: number): value is string {
  return Boolean(value && value.length <= maxLength && !/[\r\n\t]/.test(value) && !hasUnsafeControlCharacters(value));
}
