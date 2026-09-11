export const contactFieldLimits = {
  firstName: 80,
  lastName: 80,
  email: 254,
  phone: 40,
  message: 500
} as const;

export type ContactDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  website: string;
};

export type ContactField = keyof Omit<ContactDraft, "website">;
export type ContactFieldErrors = Partial<Record<ContactField, string>>;

export const initialContactDraft: ContactDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  message: "",
  website: ""
};

const emailLocalPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const emailAsciiTldPattern = /^[a-z]{2,63}$/;
const emailPunycodeTldPattern = /^xn--[a-z0-9](?:[a-z0-9-]{0,57}[a-z0-9])$/;
const phonePattern = /^[0-9A-Za-z+().,\-\s/#*]+$/;

function requiredError(value: string, message: string): string | undefined {
  return value.trim() ? undefined : message;
}

export function validateNameStep(draft: ContactDraft): ContactFieldErrors {
  return {
    firstName: requiredError(draft.firstName, "Enter your first name"),
    lastName: requiredError(draft.lastName, "Enter your last name")
  };
}

export function validateDetailsStep(draft: ContactDraft): ContactFieldErrors {
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const phoneDigitCount = phone.replace(/\D/g, "").length;
  const emailError = validateEmailField(email);
  let phoneError: string | undefined;

  if (phone && (!phonePattern.test(phone) || phoneDigitCount < 7 || phoneDigitCount > 20)) {
    phoneError = "Enter a valid phone number";
  }

  return {
    email: emailError,
    phone: phoneError,
    message:
      requiredError(draft.message, "Enter a message") ??
      (draft.message.trim().length > contactFieldLimits.message
        ? `Keep your message to ${contactFieldLimits.message} characters or fewer`
        : undefined)
  };
}

export function validateEmailField(value: string): string | undefined {
  const email = value.trim();
  if (!email) return "Enter your email address";
  return isValidEmail(email) ? undefined : "Enter a valid email address";
}

export function isValidEmail(value: string): boolean {
  if (!value || value.length > contactFieldLimits.email || /\s/.test(value)) return false;

  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== value.indexOf("@")) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1).toLowerCase();
  if (local.length > 64 || !emailLocalPattern.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (domain.length > 253 || !domain.includes(".")) return false;

  const labels = domain.split(".");
  const labelsAreValid = labels.every((label) => {
    return Boolean(label && label.length <= 63 && /^[a-z0-9-]+$/.test(label) && !label.startsWith("-") && !label.endsWith("-"));
  });
  if (!labelsAreValid) return false;

  const topLevelDomain = labels.at(-1) ?? "";
  if (emailAsciiTldPattern.test(topLevelDomain)) return true;
  if (!emailPunycodeTldPattern.test(topLevelDomain)) return false;

  try {
    return new URL(`https://${topLevelDomain}`).hostname === topLevelDomain;
  } catch {
    return false;
  }
}

export function hasFieldErrors(errors: ContactFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
