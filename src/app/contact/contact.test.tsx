import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactPage, { generateMetadata } from "@/app/contact/page";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/components/contact/TurnstileWidget", () => ({
  TurnstileWidget: ({
    onStatusChange,
    onTokenChange,
    siteKey
  }: {
    onStatusChange: (status: "ready" | "expired") => void;
    onTokenChange: (token: string) => void;
    siteKey: string;
  }) => (
    <div data-site-key={siteKey} data-testid="turnstile-mock">
      {siteKey ? (
        <>
          <button
            onClick={() => {
              onTokenChange("test-turnstile-token");
              onStatusChange("ready");
            }}
            type="button"
          >
            Complete human verification
          </button>
          <button
            onClick={() => {
              onTokenChange("");
              onStatusChange("expired");
            }}
            type="button"
          >
            Expire human verification
          </button>
        </>
      ) : (
        <p role="status">Secure verification is temporarily unavailable.</p>
      )}
    </div>
  )
}));

const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const originalPreviewSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
  process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY = "preview-only-test-key";
});

afterEach(() => {
  if (originalSiteKey === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
  }
  if (originalPreviewSiteKey === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY = originalPreviewSiteKey;
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function completeVerification() {
  const continueButton = screen.getByRole("button", { name: "Continue" });
  expect(continueButton).toBeDisabled();
  expect(screen.getByTestId("turnstile-mock")).toHaveAttribute("data-site-key", "test-site-key");

  fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
  expect(continueButton).toBeEnabled();
  fireEvent.click(continueButton);

  expect(screen.getByRole("heading", { level: 2, name: "Tell me your name" })).toBeInTheDocument();
}

function completeName(firstName = "Avery", lastName = "Nguyen") {
  fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: firstName } });
  fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: lastName } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  expect(screen.getByRole("heading", { level: 2, name: "How can I reach you?" })).toBeInTheDocument();
}

function completeDetails({
  email = "avery@example.com",
  phone = "",
  message = "I would like to discuss a professional opportunity."
}: {
  email?: string;
  phone?: string;
  message?: string;
} = {}) {
  fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: email } });
  if (phone) fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: phone } });
  fireEvent.change(screen.getByRole("textbox", { name: /Message/i }), { target: { value: message } });
  fireEvent.click(screen.getByRole("button", { name: "Review" }));

  expect(screen.getByRole("heading", { level: 2, name: "Review your request" })).toBeInTheDocument();
}

function reachReview(details?: Parameters<typeof completeDetails>[0]) {
  completeVerification();
  completeName();
  completeDetails(details);
}

function acceptAcknowledgments() {
  const checkboxes = screen.getAllByRole("checkbox");
  expect(checkboxes).toHaveLength(3);
  checkboxes.forEach((checkbox) => fireEvent.click(checkbox));
  return checkboxes;
}

function containerFromClass(className: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`.${className}`);
  if (!element) throw new Error(`Expected .${className} to be rendered.`);
  return element;
}

describe("contact route", () => {
  it("uses final public copy, a real four-step form, and no preview language", () => {
    const { container } = render(<ContactPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Contact" })).toBeInTheDocument();
    expect(
      screen.getByText(/University of Washington inbox is public and receives a high volume of email/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Verify you are human" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Step 0 of 4" })).toHaveAttribute("aria-valuenow", "0");
    expect(container.querySelector("form")).not.toHaveAttribute("action");
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    expect(container.textContent).not.toMatch(/preview|not enabled|coming soon|nothing entered/i);
    expect(screen.getByText(/This form is the quickest way to reach me\. Need another option\?/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email ngioanni@uw.edu" })).toHaveAttribute(
      "href",
      "mailto:ngioanni@uw.edu?subject=Portfolio%20Contact"
    );
  });

  it("keeps the form unavailable when the selected build has no Turnstile key", () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    render(<ContactPage />);

    expect(screen.getByTestId("turnstile-mock")).toHaveAttribute("data-site-key", "");
    expect(screen.getByRole("status")).toHaveTextContent(/secure verification is temporarily unavailable/i);
    expect(screen.queryByRole("button", { name: "Complete human verification" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("gates all four steps and shows accessible name and contact errors", () => {
    render(<ContactPage />);
    completeVerification();

    expect(screen.getByRole("progressbar", { name: "Step 1 of 4" })).toHaveAttribute("aria-valuenow", "1");
    const firstName = screen.getByLabelText(/First name/i);
    const lastName = screen.getByLabelText(/Last name/i);
    expect(firstName).toHaveAttribute("required");
    expect(firstName).toHaveAttribute("maxlength", "80");
    expect(lastName).toHaveAttribute("required");
    expect(lastName).toHaveAttribute("maxlength", "80");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Enter your first name")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Enter your last name")).toHaveAttribute("role", "alert");
    expect(firstName).toHaveAttribute("aria-invalid", "true");
    expect(lastName).toHaveAttribute("aria-invalid", "true");
    expect(firstName).toHaveAccessibleDescription("Enter your first name");
    expect(lastName).toHaveAccessibleDescription("Enter your last name");

    fireEvent.change(firstName, { target: { value: " Avery " } });
    fireEvent.change(lastName, { target: { value: " Nguyen " } });
    expect(firstName).not.toHaveAttribute("aria-invalid");
    expect(lastName).not.toHaveAttribute("aria-invalid");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("progressbar", { name: "Step 2 of 4" })).toHaveAttribute("aria-valuenow", "2");
    const email = screen.getByLabelText(/Email address/i);
    const phone = screen.getByLabelText(/Phone number/i);
    const message = screen.getByRole("textbox", { name: /Message/i });
    expect(email).toHaveAttribute("required");
    expect(email).toHaveAttribute("maxlength", "254");
    expect(phone).not.toHaveAttribute("required");
    expect(phone).toHaveAttribute("maxlength", "40");
    expect(message).toHaveAttribute("required");
    expect(message).toHaveAttribute("maxlength", "3000");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Enter your email address")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Enter a message")).toHaveAttribute("role", "alert");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(message).toHaveAttribute("aria-invalid", "true");
    expect(phone).not.toHaveAttribute("aria-invalid");

    fireEvent.change(email, { target: { value: "invalid-email" } });
    fireEvent.change(phone, { target: { value: "123" } });
    fireEvent.change(message, { target: { value: "  Please contact me about my resume.  " } });
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid phone number")).toBeInTheDocument();
    expect(phone).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(email, { target: { value: " avery@example.com " } });
    fireEvent.change(phone, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByRole("progressbar", { name: "Step 3 of 4" })).toHaveAttribute("aria-valuenow", "3");
    const review = containerFromClass("contact-review");
    expect(within(review).getByText("Avery Nguyen")).toBeInTheDocument();
    expect(within(review).getByText("avery@example.com")).toBeInTheDocument();
    expect(within(review).getByText("Not provided")).toBeInTheDocument();
    expect(within(review).getByText("Please contact me about my resume.")).toBeInTheDocument();
  });

  it("renders three clickable required acknowledgment cards and locks submission until all are accepted", () => {
    render(<ContactPage />);
    reachReview({ phone: "+44 20 7946 0958" });

    const submit = screen.getByRole("button", { name: "Send request" });
    const checkboxes = screen.getAllByRole("checkbox");
    const cards = checkboxes.map((checkbox) => checkbox.closest(".contact-consent-card"));
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute("required"));
    cards.forEach((card) => expect(card).toHaveAttribute("data-checked", "false"));
    expect(submit).toBeDisabled();
    expect(screen.getByText(/unlock Send request \(0\/3\)/)).toBeInTheDocument();

    if (!cards[0] || !cards[1] || !cards[2]) throw new Error("Expected three acknowledgment cards.");
    fireEvent.click(cards[0]);
    expect(checkboxes[0]).toBeChecked();
    expect(cards[0]).toHaveAttribute("data-checked", "true");
    expect(screen.getByText(/unlock Send request \(1\/3\)/)).toBeInTheDocument();
    expect(submit).toBeDisabled();

    fireEvent.click(cards[1]);
    fireEvent.click(cards[2]);
    expect(checkboxes.every((checkbox) => (checkbox as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText("All acknowledgments complete. Your request is ready to send.")).toBeInTheDocument();
    expect(submit).toBeEnabled();

    expect(screen.getByRole("link", { name: "Site Terms & Accuracy Notice" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
  });

  it("posts the exact trimmed contract without using local storage and renders the confirmation state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const getItemMock = vi.spyOn(Storage.prototype, "getItem");
    const setItemMock = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactPage />);
    completeVerification();
    completeName("  Avery  ", "  Nguyen  ");
    completeDetails({
      email: "  avery@example.com  ",
      phone: "  +1 (425) 555-0123  ",
      message: "  Please send the resume when convenient.  "
    });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/contact");
    expect(request).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(new Headers(request.headers).get("Accept")).toBe("application/json");
    expect(new Headers(request.headers).get("Content-Type")).toBe("application/json");

    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        "contactConsent",
        "email",
        "firstName",
        "lastName",
        "legalConsent",
        "legitimateConsent",
        "message",
        "phone",
        "startedAt",
        "submissionId",
        "turnstileToken",
        "website"
      ].sort()
    );
    expect(body).toMatchObject({
      firstName: "Avery",
      lastName: "Nguyen",
      email: "avery@example.com",
      phone: "+1 (425) 555-0123",
      message: "Please send the resume when convenient.",
      contactConsent: true,
      legalConsent: true,
      legitimateConsent: true,
      turnstileToken: "test-turnstile-token",
      website: ""
    });
    expect(body.submissionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.startedAt).toEqual(expect.any(Number));
    expect(getItemMock).not.toHaveBeenCalled();
    expect(setItemMock).not.toHaveBeenCalled();

    expect(await screen.findByRole("heading", { name: "Thank you for reaching out." })).toBeInTheDocument();
    expect(screen.getByText(/confirmation is on its way to/i)).toHaveTextContent("avery@example.com");
    expect(screen.getByText(/review your message as soon as possible/i)).toBeInTheDocument();
  });

  it("returns to verification after a failed request and preserves the completed form", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: false }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactPage />);
    reachReview({ email: "recruiter@example.com", phone: "+1 425 555 0123", message: "Recruiting inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("heading", { name: "Verify you are human" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be sent.*fresh security check/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    completeVerification();
    expect(screen.getByLabelText(/First name/i)).toHaveValue("Avery");
    expect(screen.getByLabelText(/Last name/i)).toHaveValue("Nguyen");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText(/Email address/i)).toHaveValue("recruiter@example.com");
    expect(screen.getByLabelText(/Phone number/i)).toHaveValue("+1 425 555 0123");
    expect(screen.getByRole("textbox", { name: /Message/i })).toHaveValue("Recruiting inquiry");
  });

  it("keeps noindex metadata while allowing legal-link discovery", () => {
    const metadata = generateMetadata();

    expect(metadata.title).toEqual({ absolute: "Contact | Nicolas Gioanni Portfolio" });
    expect(metadata.description).toBe("Send Nicolas Gioanni a prioritized professional contact request.");
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
