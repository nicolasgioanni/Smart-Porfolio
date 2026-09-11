import { describe, expect, it } from "vitest";
import {
  contactFieldLimits,
  hasFieldErrors,
  initialContactDraft,
  validateDetailsStep,
  validateEmailField,
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

  it("validates a trimmed email independently for on-blur feedback", () => {
    expect(validateEmailField("   ")).toBe("Enter your email address");
    expect(validateEmailField("not-an-email")).toBe("Enter a valid email address");
    expect(validateEmailField("  person@example.com  ")).toBeUndefined();
  });

  it("accepts common, multi-label, and valid internationalized email domains", () => {
    for (const email of ["person@example.co", "person@dept.example.com", "person@example.xn--p1ai"]) {
      expect(validateEmailField(email)).toBeUndefined();
    }
  });

  it("rejects incomplete provider-like and invalid top-level domains", () => {
    for (const email of [
      "person@gmai",
      "person@hotma",
      "person@tooooo",
      "person@example.c",
      "person@example.123",
      "person@example.c0m"
    ]) {
      expect(validateEmailField(email)).toBe("Enter a valid email address");
    }
  });

  it("rejects malformed punycode, address literals, and malformed domain labels", () => {
    for (const email of [
      "person@example.xn--",
      "person@example.xn---abc",
      "person@127.0.0.1",
      "person@[127.0.0.1]",
      "person@example..com",
      "person@example.com.",
      "person@-example.com",
      "person@example-.com"
    ]) {
      expect(validateEmailField(email)).toBe("Enter a valid email address");
    }
  });

  it("rejects messages longer than the compact 500-character contract", () => {
    expect(validateDetailsStep(draft({ email: "person@example.com", message: "a".repeat(500) })).message).toBeUndefined();
    expect(validateDetailsStep(draft({ email: "person@example.com", message: "a".repeat(501) })).message).toBe(
      "Keep your message to 500 characters or fewer"
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
    expect(contactFieldLimits).toEqual({ firstName: 80, lastName: 80, email: 254, phone: 40, message: 500 });
  });
});
