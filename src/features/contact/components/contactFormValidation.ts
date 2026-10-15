import {
  contactFieldLimits,
  getEmailValidationIssue,
  hasUnsafeControlCharacters,
  isValidHumanText,
  isValidPhone,
  normalizeContactMultilineText
} from "@/lib/contact/validation";

export { contactFieldLimits, isValidEmail } from "@/lib/contact/validation";

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

function requiredError(value: string, message: string): string | undefined {
  return value.trim() ? undefined : message;
}

export function validateNameStep(draft: ContactDraft): ContactFieldErrors {
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  return {
    firstName:
      requiredError(firstName, "Enter your first name") ??
      (!isValidHumanText(firstName, contactFieldLimits.firstName) ? "Enter a valid first name" : undefined),
    lastName:
      requiredError(lastName, "Enter your last name") ??
      (!isValidHumanText(lastName, contactFieldLimits.lastName) ? "Enter a valid last name" : undefined)
  };
}

export function validateDetailsStep(draft: ContactDraft): ContactFieldErrors {
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const message = normalizeContactMultilineText(draft.message);
  const emailError = validateEmailField(email);
  const phoneError = isValidPhone(phone) ? undefined : "Enter a valid phone number";

  return {
    email: emailError,
    phone: phoneError,
    message:
      requiredError(message, "Enter a message") ??
      (message.length > contactFieldLimits.message
        ? `Keep your message to ${contactFieldLimits.message} characters or fewer`
        : hasUnsafeControlCharacters(message)
          ? "Enter a valid message"
        : undefined)
  };
}

export function validateEmailField(value: string): string | undefined {
  const email = value.trim();
  if (!email) return "Enter your email address";
  const issue = getEmailValidationIssue(email);
  if (issue === "domain-ending") return "Check the email domain ending for a typo.";
  return issue ? "Enter a valid email address" : undefined;
}

export function hasFieldErrors(errors: ContactFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
