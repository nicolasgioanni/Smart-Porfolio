"use client";

import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { SmartLink } from "@/components/navigation/SmartLink";
import {
  contactFieldLimits,
  hasFieldErrors,
  initialContactDraft,
  validateDetailsStep,
  validateEmailField,
  validateNameStep,
  type ContactDraft,
  type ContactField,
  type ContactFieldErrors
} from "@/components/contact/contactFormValidation";
import { TurnstileWidget } from "@/components/contact/TurnstileWidget";

type ContactStep = 1 | 2 | 3;
type ContactView = "verification" | "form";
type ConsentField = "contact" | "legal";
type SubmissionStatus = "idle" | "submitting";
type VerificationGateStatus = "waiting" | "verifying" | "verified" | "failed";
type ContactNoticeTone = "error" | "success";

const initialConsents: Record<ConsentField, boolean> = {
  contact: false,
  legal: false
};

const verificationAutoAdvanceDelayMs = 500;

function retryAfterCopy(value: string | null): string {
  if (!value) return "Try again after the 24-hour limit resets.";

  const numericSeconds = Number(value);
  const seconds = Number.isFinite(numericSeconds) ? numericSeconds : (Date.parse(value) - Date.now()) / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0) return "Try again after the 24-hour limit resets.";

  if (seconds < 3600) {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  if (seconds < 86400) {
    const hours = Math.ceil(seconds / 3600);
    return `Try again in about ${hours} hour${hours === 1 ? "" : "s"}.`;
  }

  const days = Math.ceil(seconds / 86400);
  return `Try again in about ${days} day${days === 1 ? "" : "s"}.`;
}

const ContactNotice = forwardRef<HTMLDivElement, { children: ReactNode; tone: ContactNoticeTone }>(function ContactNotice(
  { children, tone },
  ref
) {
  const isError = tone === "error";

  return (
    <div
      aria-atomic="true"
      aria-live={isError ? "assertive" : "polite"}
      className="contact-notice"
      data-tone={tone}
      ref={ref}
      role={isError ? "alert" : "status"}
      tabIndex={-1}
    >
      <span aria-hidden="true" className="contact-notice__icon">
        {isError ? "!" : "✓"}
      </span>
      <div className="contact-notice__content">
        <strong className="contact-notice__label">{isError ? "Submission error" : "Submission successful"}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
});

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

function StepHeading({
  description,
  status,
  step,
  title
}: {
  description: string;
  status?: string;
  step: ContactStep;
  title: string;
}) {
  return (
    <header className="contact-step__heading">
      <div className="contact-step__counter-row">
        <p className="contact-step__counter">Step {step} of 3</p>
        {status ? (
          <p aria-atomic="true" aria-live="polite" className="contact-step__counter contact-step__counter--status">
            {status}
          </p>
        ) : null}
      </div>
      <h2 tabIndex={-1}>{title}</h2>
      <p>{description}</p>
      <div
        aria-label={`Step ${step} of 3`}
        aria-valuemax={3}
        aria-valuemin={1}
        aria-valuenow={step}
        className="contact-progress"
        role="progressbar"
      >
        {[1, 2, 3].map((segment) => (
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
  onBlur,
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
  onBlur?: () => void;
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
        onBlur={onBlur}
        onChange={(event) => onChange(field, event.target.value)}
        required={!optional}
        type={type}
        value={draft[field]}
      />
    </div>
  );
}

export function ContactForm({ contactEmail, turnstileSiteKey }: { contactEmail: string; turnstileSiteKey: string }) {
  const [view, setView] = useState<ContactView>("verification");
  const [step, setStep] = useState<ContactStep>(1);
  const [draft, setDraft] = useState<ContactDraft>(initialContactDraft);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [validationShake, setValidationShake] = useState<"a" | "b">("a");
  const [consents, setConsents] = useState(initialConsents);
  const [verificationGateStatus, setVerificationGateStatus] = useState<VerificationGateStatus>("waiting");
  const [turnstileWidgetAttempt, setTurnstileWidgetAttempt] = useState(0);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("idle");
  const [reviewLocked, setReviewLocked] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [formAlert, setFormAlert] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const formStartedAtRef = useRef(0);
  const submissionIdRef = useRef<string | undefined>(undefined);
  const submissionStatusRef = useRef<SubmissionStatus>("idle");
  const verificationGateStatusRef = useRef<VerificationGateStatus>("waiting");
  const reviewLockedRef = useRef(false);
  const hasDeliveryAttemptRef = useRef(false);
  const frozenRequestBodyRef = useRef<string | undefined>(undefined);
  const frozenEmailRef = useRef("");
  const verificationRequestRef = useRef(0);
  const autoAdvanceTimeoutRef = useRef<number | undefined>(undefined);
  const verifiedDestinationStepRef = useRef<ContactStep>(1);
  const successNoticeRef = useRef<HTMLDivElement>(null);
  const errorNoticeRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLDivElement>(null);
  const previousLocationRef = useRef(`${view}:${step}`);
  const mailtoHref = `mailto:${contactEmail}?subject=Portfolio%20Contact`;
  const acceptedConsentCount = Object.values(consents).filter(Boolean).length;
  const allConsentsAccepted = Object.values(consents).every(Boolean);
  const isHumanVerified = verificationGateStatus === "verified";
  const isSubmissionBusy = submissionStatus !== "idle";

  useEffect(() => {
    try {
      const nextSubmissionId = createSubmissionId();
      submissionIdRef.current = nextSubmissionId;
      setSubmissionId(nextSubmissionId);
    } catch {
      setFormAlert("Secure verification is unavailable in this browser. Please use the email link below.");
    }

    return () => {
      verificationRequestRef.current += 1;
      if (autoAdvanceTimeoutRef.current !== undefined) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const location = `${view}:${step}`;
    if (previousLocationRef.current === location) return;
    previousLocationRef.current = location;
    if (view === "form") stepHeadingRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [step, view]);

  useEffect(() => {
    if (submittedEmail) successNoticeRef.current?.focus();
  }, [submittedEmail]);

  useEffect(() => {
    if (formAlert) errorNoticeRef.current?.focus();
  }, [formAlert, step]);

  function setSubmissionPhase(status: SubmissionStatus) {
    submissionStatusRef.current = status;
    setSubmissionStatus(status);
  }

  function setVerificationPhase(status: VerificationGateStatus) {
    verificationGateStatusRef.current = status;
    setVerificationGateStatus(status);
  }

  function clearAutoAdvance() {
    if (autoAdvanceTimeoutRef.current === undefined) return;
    window.clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = undefined;
  }

  function setReviewLock(locked: boolean) {
    reviewLockedRef.current = locked;
    setReviewLocked(locked);
  }

  function unlockReviewedPayload() {
    frozenRequestBodyRef.current = undefined;
    frozenEmailRef.current = "";
    hasDeliveryAttemptRef.current = false;
    setRestartRequired(false);
    setReviewLock(false);
  }

  function focusGateHeading() {
    const focus = () => stepHeadingRef.current?.querySelector<HTMLElement>("h2")?.focus();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focus);
    } else {
      window.setTimeout(focus, 0);
    }
  }

  function failVerification(message: string) {
    verificationRequestRef.current += 1;
    clearAutoAdvance();
    setVerificationPhase("failed");
    setFormAlert(message);
  }

  function retryVerification() {
    verificationRequestRef.current += 1;
    clearAutoAdvance();
    setVerificationPhase("waiting");
    setTurnstileWidgetAttempt((current) => current + 1);
    setFormAlert("");
    focusGateHeading();
  }

  async function handleTurnstileTokenChange(token: string) {
    if (!token || verificationGateStatusRef.current !== "waiting" || !submissionIdRef.current) return;

    const requestId = verificationRequestRef.current + 1;
    verificationRequestRef.current = requestId;
    setVerificationPhase("verifying");
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
        failVerification(
          result?.error === "verification_failed"
            ? "The security check was invalid or expired. Run a fresh check to continue."
            : "Secure verification is temporarily unavailable. Try again or email me directly."
        );
        return;
      }

      setVerificationPhase("verified");
      setFormAlert("");
      clearAutoAdvance();
      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
        autoAdvanceTimeoutRef.current = undefined;
        continueAfterVerification();
      }, verificationAutoAdvanceDelayMs);
    } catch {
      if (verificationRequestRef.current !== requestId) return;
      failVerification("Secure verification is temporarily unavailable. Try again or email me directly.");
    }
  }

  function updateDraft(field: ContactField | "website", value: string) {
    if (reviewLockedRef.current) return;
    const nextDraft = { ...draft, [field]: value };
    setDraft(nextDraft);
    setFormAlert("");

    if (!(field in errors)) return;
    const nextErrors =
      field === "firstName" || field === "lastName" ? validateNameStep(nextDraft) : validateDetailsStep(nextDraft);
    setErrors((current) => ({ ...current, [field]: nextErrors[field as ContactField] }));
  }

  function replayValidationShake() {
    setValidationShake((current) => (current === "a" ? "b" : "a"));
  }

  function validateEmailOnBlur() {
    if (reviewLockedRef.current) return;
    const emailError = validateEmailField(draft.email);
    setErrors((current) => ({ ...current, email: emailError }));
    if (emailError) replayValidationShake();
  }

  function continueAfterVerification() {
    if (verificationGateStatusRef.current !== "verified") return;
    clearAutoAdvance();
    if (formStartedAtRef.current === 0) {
      formStartedAtRef.current = Date.now();
    }
    setFormAlert("");
    setStep(reviewLockedRef.current ? 3 : verifiedDestinationStepRef.current);
    setView("form");
  }

  function goToDetailsStep() {
    const nextErrors = validateNameStep(draft);
    setErrors(nextErrors);
    if (hasFieldErrors(nextErrors)) {
      replayValidationShake();
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
      replayValidationShake();
      focusField(firstInvalidField(nextErrors, ["email", "phone", "message"]));
      return;
    }

    setFormAlert("");
    setStep(3);
  }

  function updateConsent(field: ConsentField, checked: boolean) {
    if (reviewLockedRef.current) return;
    setConsents((current) => ({ ...current, [field]: checked }));
    setFormAlert("");
  }

  function toggleConsentFromCard(field: ConsentField, target: EventTarget) {
    if (reviewLockedRef.current) return;
    if (target instanceof HTMLElement && target.closest("a, input, label")) return;
    updateConsent(field, !consents[field]);
  }

  function returnToVerification(message: string) {
    verificationRequestRef.current += 1;
    clearAutoAdvance();
    setVerificationPhase("waiting");
    setTurnstileWidgetAttempt((current) => current + 1);
    setSubmissionPhase("idle");
    setReviewLock(true);
    setRestartRequired(false);
    verifiedDestinationStepRef.current = 3;
    setFormAlert(message);
    setView("verification");
  }

  function restartExpiredRequest() {
    let nextSubmissionId: string;
    try {
      nextSubmissionId = createSubmissionId();
    } catch {
      setFormAlert("Secure verification is unavailable in this browser. Please use the email link below.");
      return;
    }

    verificationRequestRef.current += 1;
    clearAutoAdvance();
    submissionIdRef.current = nextSubmissionId;
    setSubmissionId(nextSubmissionId);
    formStartedAtRef.current = 0;
    frozenRequestBodyRef.current = undefined;
    frozenEmailRef.current = "";
    hasDeliveryAttemptRef.current = false;
    verifiedDestinationStepRef.current = 3;
    setSubmissionPhase("idle");
    setReviewLock(false);
    setRestartRequired(false);
    setVerificationPhase("waiting");
    setTurnstileWidgetAttempt((current) => current + 1);
    setFormAlert("");
    setView("verification");
    focusGateHeading();
  }

  function handlePreDeliveryFailure(
    message: string,
    lockedMessage: string,
    wasPayloadPreviouslyAttempted: boolean,
    returnToEmail = false
  ) {
    setSubmissionPhase("idle");
    if (wasPayloadPreviouslyAttempted) {
      setReviewLock(true);
      setFormAlert(lockedMessage);
      return;
    }

    unlockReviewedPayload();
    setFormAlert(message);
    if (returnToEmail) setStep(2);
  }

  function beginAnotherRequest() {
    let nextSubmissionId: string;
    try {
      nextSubmissionId = createSubmissionId();
    } catch {
      setFormAlert("Secure verification is unavailable in this browser. Please use the email link below.");
      return;
    }

    submissionIdRef.current = nextSubmissionId;
    setSubmissionId(nextSubmissionId);
    formStartedAtRef.current = 0;
    setSubmittedEmail("");
    setFormAlert("");
    setVerificationPhase("waiting");
    setTurnstileWidgetAttempt((current) => current + 1);
    setRestartRequired(false);
    verifiedDestinationStepRef.current = 1;
    setView("verification");
    setStep(1);
    focusGateHeading();
  }

  function resetAfterSuccess(email: string) {
    verificationRequestRef.current += 1;
    clearAutoAdvance();
    setSubmittedEmail(email);
    setDraft(initialContactDraft);
    setConsents(initialConsents);
    setErrors({});
    submissionIdRef.current = undefined;
    setSubmissionId("");
    frozenRequestBodyRef.current = undefined;
    frozenEmailRef.current = "";
    hasDeliveryAttemptRef.current = false;
    setVerificationPhase("waiting");
    setTurnstileWidgetAttempt((current) => current + 1);
    setSubmissionPhase("idle");
    setReviewLock(false);
    setRestartRequired(false);
    setFormAlert("");
    formStartedAtRef.current = 0;
    verifiedDestinationStepRef.current = 1;
    setView("verification");
    setStep(1);
  }

  function freezeReviewedPayload(): boolean {
    if (frozenRequestBodyRef.current) return true;
    if (!submissionIdRef.current) {
      setFormAlert("Secure verification is not ready. Please wait a moment or use the email link below.");
      return false;
    }

    frozenEmailRef.current = draft.email.trim();
    frozenRequestBodyRef.current = JSON.stringify({
      submissionId: submissionIdRef.current,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: frozenEmailRef.current,
      phone: draft.phone.trim(),
      message: draft.message.trim(),
      contactConsent: consents.contact,
      legalConsent: consents.legal,
      startedAt: formStartedAtRef.current,
      website: draft.website
    });
    setReviewLock(true);
    return true;
  }

  async function deliverRequest() {
    const requestBody = frozenRequestBodyRef.current;
    if (!requestBody) {
      setSubmissionPhase("idle");
      setFormAlert("Your reviewed request is unavailable. Review the form and try again.");
      unlockReviewedPayload();
      return;
    }

    const wasPayloadPreviouslyAttempted = hasDeliveryAttemptRef.current;
    hasDeliveryAttemptRef.current = true;
    setReviewLock(true);
    setSubmissionPhase("submitting");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: requestBody
      });
      const result = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;

      if (!response.ok || result?.ok !== true) {
        if (result?.error === "verification_required") {
          returnToVerification(
            "Your secure verification session expired. Complete a fresh check to continue. Your reviewed details remain locked for a safe retry."
          );
          return;
        }

        if (result?.error === "request_expired") {
          setSubmissionPhase("idle");
          setReviewLock(true);
          setRestartRequired(true);
          setFormAlert(
            wasPayloadPreviouslyAttempted
              ? "This locked request has expired and can no longer be safely retried. It may already have been partially delivered. Start a fresh secured request only if needed, or email me directly."
              : "This request expired before delivery. Start a fresh secured request to keep your reviewed details and try again."
          );
          return;
        }

        if (result?.error === "invalid_email") {
          handlePreDeliveryFailure(
            "We couldn’t confirm that this email domain can receive messages. Check the address for typos or enter another email address.",
            "We couldn’t revalidate this email domain. Email delivery did not restart, and your reviewed details remain locked for a safe retry. Try again or email me directly.",
            wasPayloadPreviouslyAttempted,
            true
          );
          return;
        }

        if (result?.error === "rate_limited") {
          handlePreDeliveryFailure(
            `This email address has reached the limit of 2 submissions within 24 hours. ${retryAfterCopy(response.headers.get("Retry-After"))} You can edit the address or email me directly.`,
            `This retry is temporarily rate limited. ${retryAfterCopy(response.headers.get("Retry-After"))} Your reviewed details remain locked for a safe retry.`,
            wasPayloadPreviouslyAttempted,
            true
          );
          return;
        }

        if (result?.error === "email_validation_unavailable") {
          handlePreDeliveryFailure(
            "Email validation is temporarily unavailable. Your request was not sent. Please try again shortly or email me directly.",
            "Email validation is temporarily unavailable, so delivery did not restart. Your reviewed details remain locked for a safe retry. Please try again shortly or email me directly.",
            wasPayloadPreviouslyAttempted
          );
          return;
        }

        if (result?.error === "service_unavailable") {
          handlePreDeliveryFailure(
            "The contact service is temporarily unavailable. Your request was not sent. Please try again shortly or email me directly.",
            "The contact service is temporarily unavailable, so delivery did not restart. Your reviewed details remain locked for a safe retry. Please try again shortly or email me directly.",
            true
          );
          return;
        }

        setSubmissionPhase("idle");
        setFormAlert(
          "Your request could not be delivered right now. Your verification remains complete, and your reviewed details are locked for a safe retry. Try again, or email me directly."
        );
        return;
      }

      resetAfterSuccess(frozenEmailRef.current);
    } catch {
      setSubmissionPhase("idle");
      setFormAlert(
        "Your request could not reach the delivery service. Your verification remains complete, and your reviewed details are locked for a safe retry. Check your connection and try again, or email me directly."
      );
    }
  }

  async function submitRequest() {
    if (restartRequired || !allConsentsAccepted || submissionStatusRef.current !== "idle") return;

    const nameErrors = validateNameStep(draft);
    const detailErrors = validateDetailsStep(draft);
    const nextErrors = { ...nameErrors, ...detailErrors };
    if (hasFieldErrors(nextErrors)) {
      setErrors(nextErrors);
      setStep(hasFieldErrors(nameErrors) ? 1 : 2);
      return;
    }

    if (!freezeReviewedPayload()) return;
    setFormAlert("");

    if (!isHumanVerified) {
      returnToVerification(
        "Your secure verification session is unavailable. Complete a fresh check; your reviewed details remain locked."
      );
      return;
    }

    await deliverRequest();
  }

  return (
    <GlassSurface as="section" className="contact-wizard" variant="strong">
      {submittedEmail ? (
        <div className="contact-success">
          <header className="contact-step__heading">
            <p className="contact-step__counter">Request complete</p>
            <h2>Thanks for reaching out</h2>
            <p>Your message has been securely delivered. You can start a separate request whenever you are ready.</p>
          </header>
          {formAlert ? (
            <ContactNotice ref={errorNoticeRef} tone="error">
              {formAlert}
            </ContactNotice>
          ) : null}
          <ContactNotice ref={successNoticeRef} tone="success">
            Form submitted successfully. I’ll get back to you as soon as I can. A confirmation email is on its way to{" "}
            <strong>{submittedEmail}</strong>.
          </ContactNotice>
          <div className="contact-step__actions contact-step__actions--end">
            <button
              className="contact-action contact-action--primary glass-button glass-button--primary hover-base-1 hover-base-1--solid"
              onClick={beginAnotherRequest}
              type="button"
            >
              Send another message
            </button>
          </div>
          <p className="contact-email-fallback">
            Need another option? <SmartLink href={mailtoHref}>Email {contactEmail}</SmartLink>
          </p>
        </div>
      ) : (
        <form
          aria-busy={isSubmissionBusy || verificationGateStatus === "verifying"}
          className="contact-form"
          data-validation-shake={validationShake}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (view === "verification") {
              continueAfterVerification();
              return;
            }
            if (step === 1) goToDetailsStep();
            if (step === 2) goToReviewStep();
            if (step === 3) void submitRequest();
          }}
        >
        {formAlert ? (
          <ContactNotice ref={errorNoticeRef} tone="error">
            {formAlert}
          </ContactNotice>
        ) : null}
        <div ref={stepHeadingRef}>
          {view === "verification" ? (
            <div className="contact-step contact-verification-gate" data-step="verification">
              <header className="contact-step__heading">
                <p className="contact-step__counter">Secure contact form</p>
                <h2 tabIndex={-1}>Verify before continuing</h2>
                <p>Complete the security check to open the contact form.</p>
              </header>

              {submissionId &&
              (verificationGateStatus === "waiting" || verificationGateStatus === "verifying") ? (
                <TurnstileWidget
                  cData={submissionId}
                  key={turnstileWidgetAttempt}
                  onTokenChange={handleTurnstileTokenChange}
                  siteKey={turnstileSiteKey}
                />
              ) : null}

              <p
                aria-atomic="true"
                aria-live="polite"
                className="contact-gate-status"
                data-status={verificationGateStatus}
                id="contact-verification-result"
                role="status"
              >
                {verificationGateStatus === "verified"
                  ? "Security check complete. Continuing to your contact details."
                  : verificationGateStatus === "verifying"
                    ? "Confirming the security check with the server."
                    : verificationGateStatus === "failed"
                      ? "A fresh security check is required before the form can open."
                      : "The form remains locked until verification is confirmed."}
              </p>

              <div className="contact-step__actions">
                {verificationGateStatus === "failed" ? (
                  <button
                    className="contact-action contact-action--secondary glass-button glass-button--secondary hover-base-1"
                    onClick={retryVerification}
                    type="button"
                  >
                    Try security check again
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
                <button
                  aria-describedby="contact-verification-result"
                  className="contact-action contact-action--primary glass-button glass-button--primary hover-base-1 hover-base-1--solid"
                  disabled={!isHumanVerified}
                  onClick={continueAfterVerification}
                  type="button"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {view === "form" && step === 1 ? (
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

          {view === "form" && step === 2 ? (
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
                  onBlur={validateEmailOnBlur}
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
                    <span>Do not include sensitive information.</span>
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

          {view === "form" && step === 3 ? (
            <div className="contact-step" data-step="3">
              <StepHeading
                description="Review your details and confirm both acknowledgments before sending."
                status={`${acceptedConsentCount} of 2 acknowledgments checked`}
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

              <fieldset className="contact-consents">
                <legend>Required acknowledgments</legend>
                <div
                  className="contact-consent-card"
                  data-checked={consents.contact ? "true" : "false"}
                  onClick={(event) => toggleConsentFromCard("contact", event.target)}
                >
                  <input
                    checked={consents.contact}
                    disabled={reviewLocked}
                    id="contact-consent"
                    name="contactConsent"
                    onChange={(event) => updateConsent("contact", event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <label htmlFor="contact-consent">
                    I agree that Nicolas Gioanni may respond by email and, if I provide a phone number, by a manual call
                    or text. No automated or marketing messages.
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
                    disabled={reviewLocked}
                    id="legal-consent"
                    name="legalConsent"
                    onChange={(event) => updateConsent("legal", event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <span id="legal-consent-label">
                    I acknowledge the{" "}
                    <SmartLink href="/terms" onClick={(event) => event.stopPropagation()} target="_blank">Site Terms &amp; Accuracy Notice</SmartLink>{" "}
                    and{" "}
                    <SmartLink href="/privacy" onClick={(event) => event.stopPropagation()} target="_blank">Privacy Notice</SmartLink>,{" "}
                    and confirm this is a legitimate inquiry without spam, harmful content, credentials, or unnecessary
                    sensitive information.
                  </span>
                </div>
              </fieldset>

              <p className="contact-review__fine-print">
                Legitimate inquiries only. Do not include sensitive information. Sending confirms both acknowledgments.
              </p>
              {submissionStatus === "submitting" ? (
                <p aria-live="polite" className="contact-submit-status" role="status">
                  Sending your locked request...
                </p>
              ) : null}
              <div className="contact-step__actions">
                <button
                  className="contact-action contact-action--secondary glass-button glass-button--secondary hover-base-1"
                  disabled={isSubmissionBusy || reviewLocked}
                  onClick={() => setStep(2)}
                  type="button"
                >
                  Back
                </button>
                {restartRequired ? (
                  <button
                    className="contact-action contact-action--primary glass-button glass-button--primary hover-base-1 hover-base-1--solid"
                    onClick={restartExpiredRequest}
                    type="button"
                  >
                    Start fresh secured request
                  </button>
                ) : (
                  <button
                    className="contact-action contact-action--primary glass-button glass-button--primary hover-base-1 hover-base-1--solid"
                    disabled={!allConsentsAccepted || !isHumanVerified || isSubmissionBusy}
                    type="submit"
                  >
                    {submissionStatus === "submitting" ? "Sending request..." : "Send request"}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <p className="contact-email-fallback">
          Need another option?{" "}
          <SmartLink href={mailtoHref}>Email {contactEmail}</SmartLink>
        </p>
        </form>
      )}
    </GlassSurface>
  );
}
