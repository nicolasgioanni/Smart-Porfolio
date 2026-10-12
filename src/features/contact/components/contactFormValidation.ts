import { contactFieldLimits, getEmailValidationIssue, isValidPhone } from "@/lib/contact/validation";

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
  return {
    firstName: requiredError(draft.firstName, "Enter your first name"),
    lastName: requiredError(draft.lastName, "Enter your last name")
  };
}

export function validateDetailsStep(draft: ContactDraft): ContactFieldErrors {
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const emailError = validateEmailField(email);
  const phoneError = isValidPhone(phone) ? undefined : "Enter a valid phone number";

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
  const issue = getEmailValidationIssue(email);
  if (issue === "domain-ending") return "Check the email domain ending for a typo.";
  return issue ? "Enter a valid email address" : undefined;
}

export function hasFieldErrors(errors: ContactFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
