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
  installFetchMock();
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

type FetchMockOptions = {
  contact?: (attempt: number) => Promise<Response> | Response;
  verify?: (attempt: number) => Promise<Response> | Response;
};

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function installFetchMock(options: FetchMockOptions = {}) {
  let contactAttempt = 0;
  let verifyAttempt = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url === "/api/contact/verify") {
      verifyAttempt += 1;
      return options.verify?.(verifyAttempt) ?? Response.json({ ok: true });
    }
    if (url === "/api/contact") {
      contactAttempt += 1;
      return options.contact?.(contactAttempt) ?? Response.json({ ok: true });
    }
    throw new Error(`Unexpected fetch request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callsFor(fetchMock: ReturnType<typeof vi.fn>, url: string) {
  return fetchMock.mock.calls.filter(([input]) => requestUrl(input as RequestInfo | URL) === url);
}

async function completeVerification() {
  const continueButton = screen.getByRole("button", { name: "Continue" });
  expect(continueButton).toBeDisabled();
  expect(screen.getByTestId("turnstile-mock")).toHaveAttribute("data-site-key", "test-site-key");

  fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
  expect(await screen.findByRole("heading", { level: 2, name: "Tell me your name" })).toBeInTheDocument();
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

async function reachReview(details?: Parameters<typeof completeDetails>[0]) {
  await completeVerification();
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
    expect(screen.getByText(/Need another option\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/This form is the quickest way to reach me/i)).not.toBeInTheDocument();
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

  it("verifies on the server and automatically advances after a successful security check", async () => {
    const fetchMock = installFetchMock();
    render(<ContactPage />);

    await completeVerification();

    const verifyCalls = callsFor(fetchMock, "/api/contact/verify");
    expect(verifyCalls).toHaveLength(1);
    const [, request] = verifyCalls[0] as [string, RequestInit];
    expect(request).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(new Headers(request.headers).get("Accept")).toBe("application/json");
    expect(new Headers(request.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(request.body))).toEqual({
      submissionId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      turnstileToken: "test-turnstile-token"
    });
  });

  it("keeps Continue as a fallback while automatic advancement is pending", async () => {
    render(<ContactPage />);
    const continueButton = screen.getByRole("button", { name: "Continue" });

    fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
    await waitFor(() => expect(continueButton).toBeEnabled());
    expect(screen.getByText("Verification confirmed. Continuing...")).toBeInTheDocument();
    fireEvent.click(continueButton);

    expect(screen.getByRole("heading", { level: 2, name: "Tell me your name" })).toBeInTheDocument();
  });

  it("stays at the gate and permits another check when server verification fails", async () => {
    const fetchMock = installFetchMock({
      verify: () => Response.json({ error: "verification_failed", ok: false }, { status: 403 })
    });
    render(<ContactPage />);

    fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/security check could not be confirmed/i);
    expect(screen.getByRole("heading", { level: 2, name: "Verify you are human" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Complete human verification" })).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);
  });

  it("gates all four steps and shows accessible name and contact errors", async () => {
    render(<ContactPage />);
    await completeVerification();

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

  it("replays the validation shake for persistent name and contact errors", async () => {
    render(<ContactPage />);
    await completeVerification();

    const next = screen.getByRole("button", { name: "Next" });
    const form = next.closest("form");
    const firstName = screen.getByLabelText(/First name/i);
    const lastName = screen.getByLabelText(/Last name/i);
    expect(form).toHaveAttribute("data-validation-shake", "a");

    fireEvent.click(next);
    expect(form).toHaveAttribute("data-validation-shake", "b");
    expect(firstName).toHaveAttribute("aria-invalid", "true");
    expect(lastName).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter your first name")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Enter your last name")).toHaveAttribute("role", "alert");
    await waitFor(() => expect(firstName).toHaveFocus());

    fireEvent.click(next);
    expect(form).toHaveAttribute("data-validation-shake", "a");
    expect(firstName).toHaveAccessibleDescription("Enter your first name");
    expect(lastName).toHaveAccessibleDescription("Enter your last name");
    await waitFor(() => expect(firstName).toHaveFocus());

    fireEvent.change(firstName, { target: { value: "Avery" } });
    fireEvent.change(lastName, { target: { value: "Nguyen" } });
    fireEvent.click(next);

    const review = screen.getByRole("button", { name: "Review" });
    const email = screen.getByLabelText(/Email address/i);
    const message = screen.getByRole("textbox", { name: /Message/i });
    fireEvent.click(review);
    expect(form).toHaveAttribute("data-validation-shake", "b");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(message).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(email).toHaveFocus());

    fireEvent.click(review);
    expect(form).toHaveAttribute("data-validation-shake", "a");
    expect(email).toHaveAccessibleDescription("Enter your email address");
    expect(message).toHaveAccessibleDescription("Enter a message");
    await waitFor(() => expect(email).toHaveFocus());
  });

  it("renders three clickable required acknowledgment cards and locks submission until all are accepted", async () => {
    render(<ContactPage />);
    await reachReview({ phone: "+44 20 7946 0958" });

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
    expect(checkboxes[1]).toHaveAccessibleName(
      /I acknowledge the Site Terms & Accuracy Notice and confirm that I have reviewed the Privacy Notice\s*\.$/
    );
  });

  it("posts the exact trimmed contract, resets the wizard, and keeps confirmation until verification restarts", async () => {
    const fetchMock = installFetchMock();
    const getItemMock = vi.spyOn(Storage.prototype, "getItem");
    const setItemMock = vi.spyOn(Storage.prototype, "setItem");
    render(<ContactPage />);
    await completeVerification();
    completeName("  Avery  ", "  Nguyen  ");
    completeDetails({
      email: "  avery@example.com  ",
      phone: "  +1 (425) 555-0123  ",
      message: "  Please send the resume when convenient.  "
    });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1));
    expect(fetchMock.mock.calls.map(([input]) => requestUrl(input as RequestInfo | URL))).toEqual([
      "/api/contact/verify",
      "/api/contact"
    ]);

    const [url, request] = callsFor(fetchMock, "/api/contact")[0] as [string, RequestInit];
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
      website: ""
    });
    expect(body.submissionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.startedAt).toEqual(expect.any(Number));
    expect(getItemMock).not.toHaveBeenCalled();
    expect(setItemMock).not.toHaveBeenCalled();

    const successNotice = await screen.findByRole("status");
    expect(successNotice).toHaveAttribute("data-tone", "success");
    expect(successNotice).toHaveTextContent("Submission successful");
    expect(successNotice).toHaveTextContent(/Form submitted successfully.*get back to you as soon as I can/i);
    expect(successNotice).toHaveTextContent(/confirmation email is on its way to avery@example\.com/i);
    expect(successNotice).toHaveFocus();
    expect(screen.getByRole("heading", { level: 2, name: "Verify you are human" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start another request" })).toBeEnabled();
    expect(screen.queryByTestId("turnstile-mock")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete human verification" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Start another request" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Verify you are human" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
    expect(screen.queryByText("Submission successful")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Tell me your name" })).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/i)).toHaveValue("");
    expect(screen.getByLabelText(/Last name/i)).toHaveValue("");
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(2);
  });

  it("keeps the verified review and submission identifier after a delivery failure so retry is safe", async () => {
    const fetchMock = installFetchMock({
      contact: (attempt) =>
        attempt === 1
          ? Response.json({ error: "delivery_failed", ok: false }, { status: 502 })
          : Response.json({ ok: true })
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", phone: "+1 425 555 0123", message: "Recruiting inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be delivered.*verification remains complete/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/reviewed details are locked for a safe retry/i);
    expect(screen.getByRole("heading", { name: "Review your request" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verify you are human" })).not.toBeInTheDocument();
    expect(within(containerFromClass("contact-review")).getByText("Recruiting inquiry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeDisabled());

    const firstRequest = callsFor(fetchMock, "/api/contact")[0][1] as RequestInit;
    const firstSubmissionId = (JSON.parse(String(firstRequest.body)) as { submissionId: string }).submissionId;
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Form submitted successfully/i);
    expect(screen.getByRole("heading", { name: "Verify you are human" })).toBeInTheDocument();
    const contactCalls = callsFor(fetchMock, "/api/contact");
    expect(contactCalls).toHaveLength(2);
    const retryRequest = contactCalls[1][1] as RequestInit;
    expect((JSON.parse(String(retryRequest.body)) as { submissionId: string }).submissionId).toBe(firstSubmissionId);
    expect(String(retryRequest.body)).toBe(String(firstRequest.body));
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
  });

  it("refreshes a locked retry ticket without changing its UUID, startedAt, payload, or edit lock", async () => {
    const fetchMock = installFetchMock({
      contact: (attempt) => {
        if (attempt === 1) return Response.json({ error: "delivery_failed", ok: false }, { status: 502 });
        if (attempt === 2) return Response.json({ error: "verification_required", ok: false }, { status: 401 });
        return Response.json({ ok: true });
      },
      verify: (attempt) =>
        attempt === 2
          ? Response.json({ error: "verification_failed", ok: false }, { status: 403 })
          : Response.json({ ok: true })
    });
    render(<ContactPage />);
    await reachReview({
      email: "recruiter@example.com",
      phone: "+1 425 555 0123",
      message: "Locked idempotent retry inquiry"
    });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/reviewed details are locked for a safe retry/i);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("heading", { name: "Verify you are human" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/session expired.*reviewed details remain locked/i);
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(2);
    const firstTwoBodies = callsFor(fetchMock, "/api/contact").map(([, request]) => String((request as RequestInit).body));
    expect(firstTwoBodies[1]).toBe(firstTwoBodies[0]);

    fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/security check could not be confirmed/i);
    fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));

    expect(await screen.findByRole("heading", { name: "Review your request" })).toBeInTheDocument();
    expect(within(containerFromClass("contact-review")).getByText("Locked idempotent retry inquiry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeDisabled());

    const verifySubmissionIds = callsFor(fetchMock, "/api/contact/verify").map(([, request]) => {
      return (JSON.parse(String((request as RequestInit).body)) as { submissionId: string }).submissionId;
    });
    expect(verifySubmissionIds).toHaveLength(3);
    expect(new Set(verifySubmissionIds).size).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Form submitted successfully/i);
    const allContactBodies = callsFor(fetchMock, "/api/contact").map(([, request]) => String((request as RequestInit).body));
    expect(allContactBodies).toHaveLength(3);
    expect(new Set(allContactBodies).size).toBe(1);
  });

  it("returns an unroutable email to the editable details step", async () => {
    const fetchMock = installFetchMock({
      contact: () => Response.json({ error: "invalid_email", ok: false }, { status: 422 })
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@invalid.example", message: "Email validation inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-tone", "error");
    expect(alert).toHaveTextContent(/couldn’t confirm that this email domain can receive messages/i);
    expect(alert).toHaveFocus();
    expect(screen.getByRole("heading", { name: "How can I reach you?" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toHaveValue("recruiter@invalid.example");

    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: "recruiter@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => {
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeEnabled();
    });
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
  });

  it("shows the two-per-day limit and honors the Retry-After header without locking edits", async () => {
    const fetchMock = installFetchMock({
      contact: () =>
        Response.json(
          { error: "rate_limited", ok: false },
          { status: 429, headers: { "Retry-After": "3600" } }
        )
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", message: "Rate limit inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/limit of 2 submissions within 24 hours/i);
    expect(alert).toHaveTextContent(/try again in about 1 hour/i);
    expect(alert).toHaveFocus();
    expect(screen.getByRole("heading", { name: "How can I reach you?" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toHaveValue("recruiter@example.com");
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
  });

  it.each([
    ["email_validation_unavailable", /Email validation is temporarily unavailable/i],
    ["service_unavailable", /contact service is temporarily unavailable/i]
  ])("keeps %s retryable and editable because delivery did not begin", async (error, expectedCopy) => {
    installFetchMock({
      contact: () => Response.json({ error, ok: false }, { status: 503 })
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", message: "Temporary service inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(expectedCopy);
    expect(alert).toHaveTextContent(/request was not sent/i);
    expect(alert).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Review your request" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeEnabled());
  });

  it("keeps the verified review and draft after a network failure", async () => {
    const fetchMock = installFetchMock({
      contact: () => Promise.reject(new Error("network unavailable"))
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", message: "Network retry inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the delivery service.*verification remains complete/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/reviewed details are locked for a safe retry/i);
    expect(screen.getByRole("heading", { name: "Review your request" })).toBeInTheDocument();
    expect(within(containerFromClass("contact-review")).getByText("Network retry inquiry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
  });

  it("lets an ordinary pre-delivery ticket refresh keep and edit the draft with a fresh request identity", async () => {
    const fetchMock = installFetchMock({
      contact: (attempt) =>
        attempt === 1
          ? Response.json({ error: "verification_required", ok: false }, { status: 401 })
          : Response.json({ ok: true })
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", phone: "+1 425 555 0123", message: "Recruiting inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("heading", { name: "Verify you are human" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/verification session expired.*form details are still here/i);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
    const firstBody = JSON.parse(String((callsFor(fetchMock, "/api/contact")[0][1] as RequestInit).body)) as {
      startedAt: number;
      submissionId: string;
    };

    await completeVerification();
    expect(screen.getByLabelText(/First name/i)).toHaveValue("Avery");
    expect(screen.getByLabelText(/Last name/i)).toHaveValue("Nguyen");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText(/Email address/i)).toHaveValue("recruiter@example.com");
    expect(screen.getByLabelText(/Phone number/i)).toHaveValue("+1 425 555 0123");
    expect(screen.getByRole("textbox", { name: /Message/i })).toHaveValue("Recruiting inquiry");
    fireEvent.change(screen.getByRole("textbox", { name: /Message/i }), {
      target: { value: "Editable after ordinary ticket refresh" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Form submitted successfully/i);
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(2);
    const secondBody = JSON.parse(String((callsFor(fetchMock, "/api/contact")[1][1] as RequestInit).body)) as {
      message: string;
      startedAt: number;
      submissionId: string;
    };
    expect(secondBody.submissionId).not.toBe(firstBody.submissionId);
    expect(secondBody.startedAt).toBeGreaterThan(firstBody.startedAt);
    expect(secondBody.message).toBe("Editable after ordinary ticket refresh");
  });

  it("keeps noindex metadata while allowing legal-link discovery", () => {
    const metadata = generateMetadata();

    expect(metadata.title).toEqual({ absolute: "Nicolas Gioanni | Contact" });
    expect(metadata.description).toBe("Send Nicolas Gioanni a prioritized professional contact request.");
    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    });
  });
});
