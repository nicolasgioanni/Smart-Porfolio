"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { SmartLink } from "@/components/navigation/SmartLink";
import {
  contactFieldLimits,
  hasFieldErrors,
  initialContactDraft,
  validateDetailsStep,
  validateNameStep,
  type ContactDraft,
  type ContactField,
  type ContactFieldErrors
} from "@/components/contact/contactFormValidation";
import { TurnstileWidget, type TurnstileStatus } from "@/components/contact/TurnstileWidget";

type ContactStep = 0 | 1 | 2 | 3;
type ConsentField = "contact" | "legal" | "legitimate";
type SubmissionStatus = "idle" | "submitting";
type VerificationGateStatus = "waiting" | "verifying" | "verified";

const initialConsents: Record<ConsentField, boolean> = {
  contact: false,
  legal: false,
  legitimate: false
};

const verificationAutoAdvanceDelayMs = 400;

function createSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }

  throw new Error("Secure random identifiers are unavailable in this browser.");
}

function fieldId(field: ContactField): string {
  return `contact-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function firstInvalidField(errors: ContactFieldErrors, fields: ContactField[]): ContactField | undefined {
  return fields.find((field) => Boolean(errors[field]));
}

function focusField(field: ContactField | undefined) {
  if (!field) return;
  const focus = () => document.getElementById(fieldId(field))?.focus();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focus);
  } else {
    window.setTimeout(focus, 0);
  }
}

type FieldLabelProps = {
  error?: string;
  errorId: string;
  htmlFor: string;
  label: string;
  optional?: boolean;
};

function FieldLabel({ error, errorId, htmlFor, label, optional = false }: FieldLabelProps) {
  return (
    <div className="contact-field__label-row">
      <label htmlFor={htmlFor}>
        {label} {!optional ? <span aria-hidden="true">*</span> : null}
        {optional ? <span className="contact-field__optional">Optional</span> : null}
      </label>
      {error ? (
        <span className="contact-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function StepHeading({ description, step, title }: { description: string; step: ContactStep; title: string }) {
  return (
    <header className="contact-step__heading">
      <p className="contact-step__counter">Step {step} of 4</p>
      <h2 tabIndex={-1}>{title}</h2>
      <p>{description}</p>
      <div
        aria-label={`Step ${step} of 4`}
        aria-valuemax={4}
        aria-valuemin={0}
        aria-valuenow={step}
        className="contact-progress"
        role="progressbar"
      >
        {[0, 1, 2, 3].map((segment) => (
          <span aria-hidden="true" data-active={segment <= step ? "true" : "false"} key={segment} />
        ))}
      </div>
    </header>
  );
}

function ContactFieldInput({
  autoComplete,
  draft,
  error,
  field,
  inputMode,
  label,
  maxLength,
  onChange,
  optional = false,
  type = "text"
}: {
  autoComplete: string;
  draft: ContactDraft;
  error?: string;
  field: ContactField;
  inputMode?: "email" | "tel" | "text";
  label: string;
  maxLength: number;
  onChange: (field: ContactField, value: string) => void;
  optional?: boolean;
  type?: "email" | "tel" | "text";
}) {
  const inputId = fieldId(field);
  const errorId = `${inputId}-error`;

  return (
    <div className="contact-field">
      <FieldLabel error={error} errorId={errorId} htmlFor={inputId} label={label} optional={optional} />
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : undefined}
        autoComplete={autoComplete}
        id={inputId}
        inputMode={inputMode}
        maxLength={maxLength}
        name={field}
        onChange={(event) => onChange(field, event.target.value)}
        required={!optional}
        type={type}
        value={draft[field]}
      />
    </div>
  );
}

export function ContactForm({ contactEmail, turnstileSiteKey }: { contactEmail: string; turnstileSiteKey: string }) {
  const [step, setStep] = useState<ContactStep>(0);
  const [draft, setDraft] = useState<ContactDraft>(initialContactDraft);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [consents, setConsents] = useState(initialConsents);
  const [, setTurnstileStatus] = useState<TurnstileStatus>(turnstileSiteKey ? "loading" : "unavailable");
  const [verificationGateStatus, setVerificationGateStatus] = useState<VerificationGateStatus>("waiting");
  const [turnstileWidgetAttempt, setTurnstileWidgetAttempt] = useState(0);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("idle");
  const [hasDeliveryAttempt, setHasDeliveryAttempt] = useState(false);
  const [formAlert, setFormAlert] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const formStartedAtRef = useRef(Date.now());
  const submissionIdRef = useRef<string | undefined>(undefined);
  const verificationRequestRef = useRef(0);
  const autoAdvanceTimeoutRef = useRef<number | undefined>(undefined);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLDivElement>(null);
  const mailtoHref = `mailto:${contactEmail}?subject=Portfolio%20Contact`;
  const allConsentsAccepted = Object.values(consents).every(Boolean);
  const isHumanVerified = verificationGateStatus === "verified";

  useEffect(() => {
    if (step > 0) {
      stepHeadingRef.current?.querySelector<HTMLElement>("h2")?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (submittedEmail) successHeadingRef.current?.focus();
  }, [submittedEmail]);

  useEffect(
    () => () => {
      verificationRequestRef.current += 1;
      if (autoAdvanceTimeoutRef.current !== undefined) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
      }
    },
    []
  );

  const handleTurnstileStatusChange = useCallback((status: TurnstileStatus) => {
    setTurnstileStatus(status);
  }, []);

  const handleTurnstileTokenChange = useCallback(async (token: string) => {
    if (!token) return;

    if (autoAdvanceTimeoutRef.current !== undefined) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = undefined;
    }
    const requestId = verificationRequestRef.current + 1;
    verificationRequestRef.current = requestId;
    submissionIdRef.current ??= createSubmissionId();
    setVerificationGateStatus("verifying");
    setFormAlert("");

    try {
      const response = await fetch("/api/contact/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          submissionId: submissionIdRef.current,
          turnstileToken: token
        })
      });
      const result = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;

      if (verificationRequestRef.current !== requestId) return;
      if (!response.ok || result?.ok !== true) {
        if (autoAdvanceTimeoutRef.current !== undefined) {
          window.clearTimeout(autoAdvanceTimeoutRef.current);
          autoAdvanceTimeoutRef.current = undefined;
        }
        submissionIdRef.current = undefined;
        setVerificationGateStatus("waiting");
        setTurnstileWidgetAttempt((current) => current + 1);
        setFormAlert(
          result?.error === "verification_failed"
            ? "The security check could not be confirmed. Please run it again."
            : "Secure verification is temporarily unavailable. Please try again or email me directly."
        );
        return;
      }

      formStartedAtRef.current = Date.now();
      setVerificationGateStatus("verified");
      setFormAlert("");
      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
        autoAdvanceTimeoutRef.current = undefined;
        setStep((current) => (current === 0 ? 1 : current));
      }, verificationAutoAdvanceDelayMs);
    } catch {
      if (verificationRequestRef.current !== requestId) return;
      if (autoAdvanceTimeoutRef.current !== undefined) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = undefined;
      }
      submissionIdRef.current = undefined;
      setVerificationGateStatus("waiting");
      setTurnstileWidgetAttempt((current) => current + 1);
      setFormAlert("Secure verification is temporarily unavailable. Please try again or email me directly.");
    }
  }, []);

  function updateDraft(field: ContactField | "website", value: string) {
    const nextDraft = { ...draft, [field]: value };
    setDraft(nextDraft);
    setFormAlert("");

    if (!(field in errors)) return;
    const nextErrors =
      field === "firstName" || field === "lastName" ? validateNameStep(nextDraft) : validateDetailsStep(nextDraft);
    setErrors((current) => ({ ...current, [field]: nextErrors[field as ContactField] }));
  }

  function goToNameStep() {
    if (!isHumanVerified) return;
    if (autoAdvanceTimeoutRef.current !== undefined) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = undefined;
    }
    setFormAlert("");
    setStep(1);
  }

  function goToDetailsStep() {
    const nextErrors = validateNameStep(draft);
    setErrors(nextErrors);
    if (hasFieldErrors(nextErrors)) {
      focusField(firstInvalidField(nextErrors, ["firstName", "lastName"]));
      return;
    }

    setFormAlert("");
    setStep(2);
  }

  function goToReviewStep() {
    const nextErrors = validateDetailsStep(draft);
    setErrors(nextErrors);
    if (hasFieldErrors(nextErrors)) {
      focusField(firstInvalidField(nextErrors, ["email", "phone", "message"]));
      return;
    }

    setFormAlert("");
    setStep(3);
  }

  function updateConsent(field: ConsentField, checked: boolean) {
    if (hasDeliveryAttempt) return;
    setConsents((current) => ({ ...current, [field]: checked }));
    setFormAlert("");
  }

  function toggleConsentFromCard(field: ConsentField, target: EventTarget) {
    if (hasDeliveryAttempt) return;
    if (target instanceof HTMLElement && target.closest("a, input, label")) return;
    updateConsent(field, !consents[field]);
  }

  function returnToVerification(message: string) {
    verificationRequestRef.current += 1;
    if (autoAdvanceTimeoutRef.current !== undefined) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = undefined;
    }
    submissionIdRef.current = undefined;
    setVerificationGateStatus("waiting");
    setTurnstileStatus("loading");
    setTurnstileWidgetAttempt((current) => current + 1);
    setSubmissionStatus("idle");
    setHasDeliveryAttempt(false);
    setFormAlert(message);
    formStartedAtRef.current = Date.now();
    setStep(0);
  }

  async function submitRequest() {
    if (!allConsentsAccepted || !isHumanVerified || submissionStatus === "submitting") return;

    const nameErrors = validateNameStep(draft);
    const detailErrors = validateDetailsStep(draft);
    const nextErrors = { ...nameErrors, ...detailErrors };
    if (hasFieldErrors(nextErrors)) {
      setErrors(nextErrors);
      setStep(hasFieldErrors(nameErrors) ? 1 : 2);
      return;
    }

    setSubmissionStatus("submitting");
    setHasDeliveryAttempt(true);
    setFormAlert("");

    try {
      if (!submissionIdRef.current) {
        returnToVerification("Your secure verification session is unavailable. Complete the check again; your form details are still here.");
        return;
      }
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          submissionId: submissionIdRef.current,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim(),
          message: draft.message.trim(),
          contactConsent: consents.contact,
          legalConsent: consents.legal,
          legitimateConsent: consents.legitimate,
          startedAt: formStartedAtRef.current,
          website: draft.website
        })
      });
      const result = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;

      if (!response.ok || result?.ok !== true) {
        if (result?.error === "verification_required") {
          returnToVerification(
            "Your secure verification session expired. Complete the check again; your form details are still here."
          );
          return;
        }

        setSubmissionStatus("idle");
        setFormAlert(
          "Your request could not be delivered right now. Your verification remains complete, and your reviewed details are locked for a safe retry. Try again, or email me directly."
        );
        return;
      }

      setSubmittedEmail(draft.email.trim());
      setDraft(initialContactDraft);
      setConsents(initialConsents);
      setErrors({});
      submissionIdRef.current = undefined;
      setSubmissionStatus("idle");
      setHasDeliveryAttempt(false);
      setFormAlert("");
    } catch {
      setSubmissionStatus("idle");
      setFormAlert(
        "Your request could not reach the delivery service. Your verification remains complete, and your reviewed details are locked for a safe retry. Check your connection and try again, or email me directly."
      );
    }
  }

  if (submittedEmail) {
    return (
      <GlassSurface as="section" className="contact-wizard contact-success" variant="strong">
        <p className="contact-step__counter">Request received</p>
        <h2 ref={successHeadingRef} tabIndex={-1}>
          Thank you for reaching out.
        </h2>
        <p>
          Your request was sent successfully. A confirmation is on its way to <strong>{submittedEmail}</strong>, and I will
          review your message as soon as possible.
        </p>
        <p className="contact-success__note">
          If you need to add important context, email <SmartLink href={mailtoHref}>{contactEmail}</SmartLink>.
        </p>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface as="section" className="contact-wizard" variant="strong">
      <form
        className="contact-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 0) goToNameStep();
          if (step === 1) goToDetailsStep();
          if (step === 2) goToReviewStep();
          if (step === 3) void submitRequest();
        }}
      >
        <div ref={stepHeadingRef}>
          {step === 0 ? (
            <div className="contact-step" data-step="0">
              <StepHeading
                description="Complete the secure check to begin. Your answers stay in this form as you move between steps."
                step={0}
                title="Verify you are human"
              />
              <TurnstileWidget
                key={turnstileWidgetAttempt}
                onStatusChange={handleTurnstileStatusChange}
                onTokenChange={handleTurnstileTokenChange}
                siteKey={turnstileSiteKey}
              />
              {verificationGateStatus === "verifying" ? (
                <p className="contact-submit-status" role="status">
                  Confirming secure verification...
                </p>
              ) : null}
              {verificationGateStatus === "verified" ? (
                <p className="contact-submit-status" role="status">
                  Verification confirmed. Continuing...
                </p>
              ) : null}
              {formAlert ? (
                <p className="contact-form__alert" role="alert">
                  {formAlert}
                </p>
              ) : null}
              <div className="contact-step__actions contact-step__actions--end">
                <button
                  className="contact-action contact-action--primary glass-button glass-button--primary hover-base-1 hover-base-1--solid"
                  disabled={!isHumanVerified}
                  onClick={goToNameStep}
                  type="button"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="contact-step" data-step="1">
              <StepHeading description="Tell me who I will be replying to." step={1} title="Tell me your name" />
              <div className="contact-fields">
                <ContactFieldInput
                  autoComplete="given-name"
                  draft={draft}
                  error={errors.firstName}
                  field="firstName"
                  label="First name"
                  maxLength={contactFieldLimits.firstName}
                  onChange={updateDraft}
                />
                <ContactFieldInput
                  autoComplete="family-name"
                  draft={draft}
                  error={errors.lastName}
                  field="lastName"
                  label="Last name"
                  maxLength={contactFieldLimits.lastName}
                  onChange={updateDraft}
                />
              </div>
              <p className="contact-required-note">
                <span aria-hidden="true">*</span> Required
              </p>
              <div className="contact-step__actions contact-step__actions--end">
                <button
                  className="contact-action contact-action--primary glass-button glass-button--primary hover-base-1 hover-base-1--solid"
                  onClick={goToDetailsStep}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="contact-step" data-step="2">
              <StepHeading
                description="Email is required for your confirmation. A phone number can help me respond more quickly."
                step={2}
                title="How can I reach you?"
              />
              <div className="contact-fields">
                <ContactFieldInput
                  autoComplete="email"
                  draft={draft}
                  error={errors.email}
                  field="email"
                  inputMode="email"
                  label="Email address"
                  maxLength={contactFieldLimits.email}
                  onChange={updateDraft}
                  type="email"
                />
                <ContactFieldInput
                  autoComplete="tel"
                  draft={draft}
                  error={errors.phone}
                  field="phone"
                  inputMode="tel"
                  label="Phone number"
                  maxLength={contactFieldLimits.phone}
                  onChange={updateDraft}
                  optional
                  type="tel"
                />
                <div className="contact-field">
                  <FieldLabel error={errors.message} errorId="contact-message-error" htmlFor="contact-message" label="Message" />
                  <textarea
                    aria-describedby={errors.message ? "contact-message-error" : "contact-message-help"}
                    aria-invalid={errors.message ? "true" : undefined}
                    id="contact-message"
                    maxLength={contactFieldLimits.message}
                    name="message"
                    onChange={(event) => updateDraft("message", event.target.value)}
                    required
                    rows={7}
                    value={draft.message}
                  />
                  <div className="contact-field__meta" id="contact-message-help">
                    <span>
                      Do not include passwords, payment data, government identifiers, medical information, or other secrets.
                    </span>
                    <span>
                      {draft.message.length.toLocaleString()} / {contactFieldLimits.message.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <p className="contact-required-note">
                <span aria-hidden="true">*</span> Required
              </p>
              <div aria-hidden="true" className="contact-honeypot">
                <label htmlFor="contact-website">Website</label>
                <input
                  autoComplete="off"
                  id="contact-website"
                  name="website"
                  onChange={(event) => updateDraft("website", event.target.value)}
                  tabIndex={-1}
                  type="text"
                  value={draft.website}
                />
              </div>
              <div className="contact-step__actions">
                <button
                  className="contact-action contact-action--secondary glass-button glass-button--secondary hover-base-1"
                  onClick={() => setStep(1)}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="contact-action contact-action--primary glass-button glass-button--primary hover-base-1 hover-base-1--solid"
                  onClick={goToReviewStep}
                  type="button"
                >
                  Review
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="contact-step" data-step="3">
              <StepHeading
                description="Review your details and confirm the three acknowledgments before sending."
                step={3}
                title="Review your request"
              />
              <dl className="contact-review">
                <div>
                  <dt>Name</dt>
                  <dd>{draft.firstName.trim()} {draft.lastName.trim()}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{draft.email.trim()}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{draft.phone.trim() || "Not provided"}</dd>
                </div>
                <div className="contact-review__message">
                  <dt>Message</dt>
                  <dd>{draft.message.trim()}</dd>
                </div>
              </dl>

              <aside className="contact-safety-note">
                Abusive, deceptive, automated, or irrelevant requests may be blocked or ignored. Never submit credentials,
                financial information, government identifiers, medical information, or unnecessary sensitive data.
              </aside>

              <fieldset className="contact-consents">
                <legend>Required acknowledgments</legend>
                <div
                  className="contact-consent-card"
                  data-checked={consents.contact ? "true" : "false"}
                  onClick={(event) => toggleConsentFromCard("contact", event.target)}
                >
                  <input
                    checked={consents.contact}
                    disabled={hasDeliveryAttempt}
                    id="contact-consent"
                    name="contactConsent"
                    onChange={(event) => updateConsent("contact", event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <label htmlFor="contact-consent">
                    I agree that Nicolas Gioanni may contact me about this request by email and, if I provide a phone
                    number, by a manual call or text. Carrier message and data rates may apply. No automated or marketing
                    messages.
                  </label>
                </div>
                <div
                  className="contact-consent-card"
                  data-checked={consents.legal ? "true" : "false"}
                  onClick={(event) => toggleConsentFromCard("legal", event.target)}
                >
                  <input
                    aria-labelledby="legal-consent-label"
                    checked={consents.legal}
                    disabled={hasDeliveryAttempt}
                    id="legal-consent"
                    name="legalConsent"
                    onChange={(event) => updateConsent("legal", event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <span id="legal-consent-label">
                    I agree to the{" "}
                    <SmartLink href="/terms" onClick={(event) => event.stopPropagation()} target="_blank">
                      Site Terms &amp; Accuracy Notice
                    </SmartLink>{" "}
                    and acknowledge the{" "}
                    <SmartLink href="/privacy" onClick={(event) => event.stopPropagation()} target="_blank">
                      Privacy Notice
                    </SmartLink>
                    .
                  </span>
                </div>
                <div
                  className="contact-consent-card"
                  data-checked={consents.legitimate ? "true" : "false"}
                  onClick={(event) => toggleConsentFromCard("legitimate", event.target)}
                >
                  <input
                    checked={consents.legitimate}
                    disabled={hasDeliveryAttempt}
                    id="legitimate-consent"
                    name="legitimateConsent"
                    onChange={(event) => updateConsent("legitimate", event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <label htmlFor="legitimate-consent">
                    I confirm this is a legitimate inquiry and contains no spam, harassment, malicious or unlawful
                    material, credentials, or unnecessary sensitive information.
                  </label>
                </div>
              </fieldset>

              <div className="contact-submit-status" aria-live="polite">
                {allConsentsAccepted
                  ? "All acknowledgments complete. Your request is ready to send."
                  : `Complete all 3 acknowledgments to unlock Send request (${Object.values(consents).filter(Boolean).length}/3).`}
              </div>
              {formAlert ? (
                <p className="contact-form__alert" role="alert">
                  {formAlert}
                </p>
              ) : null}
              <div className="contact-step__actions">
                <button
                  className="contact-action contact-action--secondary glass-button glass-button--secondary hover-base-1"
                  disabled={submissionStatus === "submitting" || hasDeliveryAttempt}
                  onClick={() => setStep(2)}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="contact-action contact-action--primary glass-button glass-button--primary hover-base-1 hover-base-1--solid"
                  disabled={!allConsentsAccepted || !isHumanVerified || submissionStatus === "submitting"}
                  type="submit"
                >
                  {submissionStatus === "submitting" ? "Sending request..." : "Send request"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <p className="contact-email-fallback">
          This form is the quickest way to reach me. Need another option?{" "}
          <SmartLink href={mailtoHref}>Email {contactEmail}</SmartLink>
        </p>
      </form>
    </GlassSurface>
  );
}
