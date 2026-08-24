import { describe, expect, it } from "vitest";
import {
  contactFieldLimits,
  hasFieldErrors,
  initialContactDraft,
  validateDetailsStep,
  validateNameStep,
  type ContactDraft
} from "@/components/contact/contactFormValidation";

function draft(overrides: Partial<ContactDraft> = {}): ContactDraft {
  return { ...initialContactDraft, ...overrides };
}

describe("contact form validation", () => {
  it("requires both names and accepts trimmed names", () => {
    const missing = validateNameStep(draft());
    expect(missing).toEqual({ firstName: "Enter your first name", lastName: "Enter your last name" });
    expect(hasFieldErrors(missing)).toBe(true);

    const complete = validateNameStep(draft({ firstName: " Avery ", lastName: " Nguyen " }));
    expect(complete).toEqual({ firstName: undefined, lastName: undefined });
    expect(hasFieldErrors(complete)).toBe(false);
  });

  it("requires a valid email and message while keeping phone optional", () => {
    expect(validateDetailsStep(draft())).toEqual({
      email: "Enter your email address",
      phone: undefined,
      message: "Enter a message"
    });

    expect(
      validateDetailsStep(draft({ email: "person@example.com", message: "Professional inquiry", phone: "" }))
    ).toEqual({ email: undefined, phone: undefined, message: undefined });

    expect(validateDetailsStep(draft({ email: "not-an-email", message: "Hello" })).email).toBe(
      "Enter a valid email address"
    );
  });

  it("accepts international-friendly phone formatting and rejects malformed or implausible values", () => {
    for (const phone of ["+44 20 7946 0958", "+1 (425) 555-0123", "425-555-0123 x204"]) {
      expect(validateDetailsStep(draft({ email: "person@example.com", message: "Hello", phone })).phone).toBeUndefined();
    }

    for (const phone of ["123", "+1 425 CALL-NOW", "1".repeat(21)]) {
      expect(validateDetailsStep(draft({ email: "person@example.com", message: "Hello", phone })).phone).toBe(
        "Enter a valid phone number"
      );
    }
  });

  it("publishes the same field limits enforced by the form and endpoint contract", () => {
    expect(contactFieldLimits).toEqual({ firstName: 80, lastName: 80, email: 254, phone: 40, message: 3000 });
  });
});
