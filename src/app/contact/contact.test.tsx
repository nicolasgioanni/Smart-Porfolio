import type { AnchorHTMLAttributes } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactPage, { generateMetadata } from "@/app/contact/page";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

const turnstileHarness = vi.hoisted(() => ({ resets: 0, tokenIndex: 0 }));

vi.mock("@/components/contact/TurnstileWidget", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  type MockStatus = "error" | "expired" | "loading" | "ready" | "unavailable";
  type MockProps = {
    cData: string;
    onStatusChange?: (status: MockStatus) => void;
    onTokenChange: (token: string) => void;
    siteKey: string;
  };

  function TurnstileWidget({ cData, onStatusChange, onTokenChange, siteKey }: MockProps) {
    const [status, setStatus] = React.useState<MockStatus>(siteKey ? "loading" : "unavailable");
    const statusCallbackRef = React.useRef<NonNullable<MockProps["onStatusChange"]>>(() => undefined);
    const tokenCallbackRef = React.useRef<MockProps["onTokenChange"]>(() => undefined);
    if (typeof onStatusChange === "function") statusCallbackRef.current = onStatusChange;
    if (typeof onTokenChange === "function") tokenCallbackRef.current = onTokenChange;

    const reportStatus = React.useCallback((nextStatus: MockStatus) => {
      setStatus(nextStatus);
      statusCallbackRef.current(nextStatus);
    }, []);

    const issueToken = React.useCallback(() => {
      turnstileHarness.tokenIndex += 1;
      reportStatus("ready");
      tokenCallbackRef.current(`test-turnstile-token-${turnstileHarness.tokenIndex}`);
    }, [reportStatus]);

    const clearToken = React.useCallback(
      (nextStatus: "error" | "expired") => {
        tokenCallbackRef.current("");
        reportStatus(nextStatus);
      },
      [reportStatus]
    );

    React.useEffect(() => {
      reportStatus(siteKey ? "loading" : "unavailable");
    }, [cData, reportStatus, siteKey]);

    return (
      <div
        data-appearance="always"
        data-cdata={cData}
        data-execution="render"
        data-site-key={siteKey}
        data-status={status}
        data-testid="turnstile-mock"
      >
        {siteKey ? (
          <>
            <button onClick={issueToken} type="button">
              Complete human verification
            </button>
            <button onClick={() => clearToken("expired")} type="button">
              Expire human verification
            </button>
            <button onClick={() => clearToken("error")} type="button">
              Fail human verification
            </button>
            {status === "expired" || status === "error" ? (
              <button
                onClick={() => {
                  turnstileHarness.resets += 1;
                  tokenCallbackRef.current("");
                  reportStatus("loading");
                }}
                type="button"
              >
                Run check again
              </button>
            ) : null}
          </>
        ) : (
          <p role="status">Secure verification is temporarily unavailable.</p>
        )}
      </div>
    );
  }

  return { TurnstileWidget };
});

const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const originalPreviewSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
  process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY = "preview-only-test-key";
  turnstileHarness.resets = 0;
  turnstileHarness.tokenIndex = 0;
  installFetchMock();
});

afterEach(() => {
  if (originalSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
  if (originalPreviewSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY = originalPreviewSiteKey;
  vi.useRealTimers();
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function currentGateWidget(): Promise<HTMLElement> {
  const widget = await screen.findByTestId("turnstile-mock");
  expect(widget).toHaveAttribute("data-appearance", "always");
  expect(widget).toHaveAttribute("data-execution", "render");
  return widget;
}

async function completeVerification(destination: "name" | "review" = "name"): Promise<string> {
  const widget = await currentGateWidget();
  const submissionId = widget.getAttribute("data-cdata");
  expect(submissionId).toMatch(/^[0-9a-f-]{36}$/i);

  fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
  const continueButton = screen.getByRole("button", { name: "Continue" });
  await waitFor(() => expect(continueButton).toBeEnabled());
  fireEvent.click(continueButton);

  const destinationHeading = destination === "review" ? "Review your request" : "Tell me your name";
  expect(await screen.findByRole("heading", { level: 2, name: destinationHeading })).toBeInTheDocument();
  return submissionId ?? "";
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
  const submissionId = await completeVerification();
  completeName();
  completeDetails(details);
  return submissionId;
}

function acceptAcknowledgments() {
  const checkboxes = screen.getAllByRole("checkbox");
  expect(checkboxes).toHaveLength(2);
  checkboxes.forEach((checkbox) => fireEvent.click(checkbox));
  return checkboxes;
}

function containerFromClass(className: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`.${className}`);
  if (!element) throw new Error(`Expected .${className} to be rendered.`);
  return element;
}

describe("contact route", () => {
  it("starts at a visible hard verification gate before the three form steps", async () => {
    const fetchMock = installFetchMock();
    const { container } = render(<ContactPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Contact" })).toBeInTheDocument();
    expect(screen.getByText(/University of Washington inbox is public and receives a high volume of email/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Verify before continuing" })).toBeInTheDocument();
    expect(screen.getByText(/form remains locked until verification is confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
    expect(await currentGateWidget()).toHaveAttribute("data-site-key", "test-site-key");
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(0);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);
    expect(container.querySelector("form")).not.toHaveAttribute("action");
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    expect(screen.getByRole("link", { name: "Email ngioanni@uw.edu" })).toHaveAttribute(
      "href",
      "mailto:ngioanni@uw.edu?subject=Portfolio%20Contact"
    );
  });

  it("fails closed at the gate when the selected build has no Turnstile key", async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const fetchMock = installFetchMock();
    render(<ContactPage />);

    expect(await currentGateWidget()).toHaveAttribute("data-site-key", "");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByText(/Secure verification is temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(0);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);
  });

  it("verifies the UUID-bound token on the server and keeps Continue as an immediate fallback", async () => {
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    const widget = await currentGateWidget();
    const submissionId = widget.getAttribute("data-cdata");

    fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    expect(screen.getByText(/Security check complete\. Continuing to your contact details/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);

    const verifyRequest = callsFor(fetchMock, "/api/contact/verify")[0][1] as RequestInit;
    expect(verifyRequest).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(new Headers(verifyRequest.headers).get("Accept")).toBe("application/json");
    expect(new Headers(verifyRequest.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(verifyRequest.body))).toEqual({
      submissionId,
      turnstileToken: "test-turnstile-token-1"
    });

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const heading = await screen.findByRole("heading", { level: 2, name: "Tell me your name" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("progressbar", { name: "Step 1 of 3" })).toHaveAttribute("aria-valuenow", "1");
  });

  it("automatically advances 500 ms after successful server verification", async () => {
    render(<ContactPage />);
    await currentGateWidget();

    fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    expect(screen.getByRole("heading", { name: "Verify before continuing" })).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { level: 2, name: "Tell me your name" }, { timeout: 2_000 })
    ).toBeInTheDocument();
  });

  it("blocks duplicate token callbacks while server verification is pending", async () => {
    const pendingVerification = deferred<Response>();
    const fetchMock = installFetchMock({ verify: () => pendingVerification.promise });
    render(<ContactPage />);
    await currentGateWidget();
    const complete = screen.getByRole("button", { name: "Complete human verification" });

    fireEvent.click(complete);
    fireEvent.click(complete);
    await waitFor(() => expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);

    await act(async () => pendingVerification.resolve(Response.json({ ok: true })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Tell me your name" })).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
  });

  it.each([
    ["verification_failed", 400, /security check was invalid or expired/i],
    ["verification_unavailable", 503, /Secure verification is temporarily unavailable/i]
  ] as const)("recovers from %s with a fresh token bound to the same logical message", async (error, status, copy) => {
    const fetchMock = installFetchMock({
      verify: (attempt) =>
        attempt === 1 ? Response.json({ error, ok: false }, { status }) : Response.json({ ok: true })
    });
    render(<ContactPage />);
    const firstWidget = await currentGateWidget();
    const submissionId = firstWidget.getAttribute("data-cdata");

    fireEvent.click(screen.getByRole("button", { name: "Complete human verification" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(screen.getByRole("heading", { name: "Verify before continuing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try security check again" }));
    expect(await currentGateWidget()).toHaveAttribute("data-cdata", submissionId);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Verify before continuing" })).toHaveFocus());

    await completeVerification();
    const verifyBodies = callsFor(fetchMock, "/api/contact/verify").map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)) as { submissionId: string; turnstileToken: string }
    );
    expect(verifyBodies).toHaveLength(2);
    expect(new Set(verifyBodies.map((body) => body.submissionId))).toEqual(new Set([submissionId]));
    expect(verifyBodies[0].turnstileToken).not.toBe(verifyBodies[1].turnstileToken);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);
  });

  it("recovers from widget error and expiry without opening the form", async () => {
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    await currentGateWidget();

    fireEvent.click(screen.getByRole("button", { name: "Expire human verification" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Run check again" }));
    fireEvent.click(screen.getByRole("button", { name: "Fail human verification" }));
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run check again" }));
    expect(turnstileHarness.resets).toBe(2);

    await completeVerification();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
  });

  it("shows accessible validation, on-blur email feedback, and the 500-character limit", async () => {
    render(<ContactPage />);
    await completeVerification();

    const firstName = screen.getByLabelText(/First name/i);
    const lastName = screen.getByLabelText(/Last name/i);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Enter your first name")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Enter your last name")).toHaveAttribute("role", "alert");
    expect(firstName).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(firstName).toHaveFocus());

    fireEvent.change(firstName, { target: { value: "Avery" } });
    fireEvent.change(lastName, { target: { value: "Nguyen" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("progressbar", { name: "Step 2 of 3" })).toHaveAttribute("aria-valuenow", "2");

    const email = screen.getByLabelText(/Email address/i);
    const phone = screen.getByLabelText(/Phone number/i);
    const message = screen.getByRole("textbox", { name: /Message/i });
    expect(email).toHaveAttribute("maxlength", "254");
    expect(phone).not.toHaveAttribute("required");
    expect(message).toHaveAttribute("maxlength", "500");
    expect(screen.getByText("0 / 500")).toBeInTheDocument();

    fireEvent.change(email, { target: { value: "invalid-email" } });
    fireEvent.blur(email);
    expect(screen.getByText("Enter a valid email address")).toHaveAttribute("role", "alert");
    expect(email).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(email, { target: { value: "avery@example.com" } });
    fireEvent.change(message, { target: { value: "a".repeat(501) } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Keep your message to 500 characters or fewer")).toHaveAttribute("role", "alert");

    fireEvent.change(message, { target: { value: "Professional inquiry" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("progressbar", { name: "Step 3 of 3" })).toHaveAttribute("aria-valuenow", "3");
  });

  it("requires both acknowledgments and shows their count in the step header", async () => {
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    await reachReview({ phone: "+44 20 7946 0958" });
    const submit = screen.getByRole("button", { name: "Send request" });
    const checkboxes = screen.getAllByRole("checkbox");
    const cards = checkboxes.map((checkbox) => checkbox.closest(".contact-consent-card"));

    expect(checkboxes).toHaveLength(2);
    expect(screen.getByText("0 of 2 acknowledgments checked")).toBeInTheDocument();
    expect(submit).toBeDisabled();
    if (!cards[0] || !cards[1]) throw new Error("Expected two acknowledgment cards.");
    fireEvent.click(cards[0]);
    expect(screen.getByText("1 of 2 acknowledgments checked")).toBeInTheDocument();
    fireEvent.click(cards[1]);
    expect(screen.getByText("2 of 2 acknowledgments checked")).toBeInTheDocument();
    expect(submit).toBeEnabled();
    expect(screen.getByText(/Legitimate inquiries only.*Sending confirms both acknowledgments/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Site Terms & Accuracy Notice" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);
  });

  it("reuses the gate ticket for the exact two-consent delivery contract and shows standalone success", async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = installFetchMock();
    const getItemMock = vi.spyOn(Storage.prototype, "getItem");
    const setItemMock = vi.spyOn(Storage.prototype, "setItem");
    render(<ContactPage />);
    const submissionId = await completeVerification();
    now += 60_000;
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

    const request = callsFor(fetchMock, "/api/contact")[0][1] as RequestInit;
    expect(request).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(JSON.parse(String(request.body))).toEqual({
      submissionId,
      firstName: "Avery",
      lastName: "Nguyen",
      email: "avery@example.com",
      phone: "+1 (425) 555-0123",
      message: "Please send the resume when convenient.",
      contactConsent: true,
      legalConsent: true,
      startedAt: 1_700_000_000_000,
      website: ""
    });
    expect(String(request.body)).not.toContain("legitimateConsent");
    expect(getItemMock).not.toHaveBeenCalled();
    expect(setItemMock).not.toHaveBeenCalled();

    const successNotice = await screen.findByRole("status");
    expect(successNotice).toHaveAttribute("data-tone", "success");
    expect(successNotice).toHaveTextContent(/confirmation email is on its way to avery@example\.com/i);
    expect(successNotice).toHaveFocus();
    expect(screen.getByRole("heading", { level: 2, name: "Thanks for reaching out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send another message" })).toBeEnabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("turnstile-mock")).not.toBeInTheDocument();
  });

  it("blocks repeated Send actions while delivery is pending", async () => {
    const pendingDelivery = deferred<Response>();
    const fetchMock = installFetchMock({ contact: () => pendingDelivery.promise });
    render(<ContactPage />);
    await reachReview({ message: "Please process this only once." });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1));
    const busySend = screen.getByRole("button", { name: "Sending request..." });
    expect(busySend).toBeDisabled();
    fireEvent.click(busySend);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);

    await act(async () => pendingDelivery.resolve(Response.json({ ok: true })));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
  });

  it("retries a failed delivery with the identical frozen payload and valid ticket", async () => {
    const fetchMock = installFetchMock({
      contact: (attempt) =>
        attempt === 1
          ? Response.json({ error: "delivery_failed", ok: false }, { status: 502 })
          : Response.json({ ok: true })
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", phone: "+1 425 555 0123", message: "Recruiting inquiry" });
    const checkboxes = acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be delivered.*verification remains complete/i);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    checkboxes.forEach((checkbox) => expect(checkbox).toBeDisabled());

    const firstBody = String((callsFor(fetchMock, "/api/contact")[0][1] as RequestInit).body);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();
    const contactCalls = callsFor(fetchMock, "/api/contact");
    expect(contactCalls).toHaveLength(2);
    expect(String((contactCalls[1][1] as RequestInit).body)).toBe(firstBody);
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
  });

  it("refreshes an expired ticket without changing the locked delivery identity or body", async () => {
    const fetchMock = installFetchMock({
      contact: (attempt) => {
        if (attempt === 1) return Response.json({ error: "delivery_failed", ok: false }, { status: 502 });
        if (attempt === 2) return Response.json({ error: "verification_required", ok: false }, { status: 401 });
        return Response.json({ ok: true });
      }
    });
    render(<ContactPage />);
    const submissionId = await reachReview({
      email: "recruiter@example.com",
      phone: "+1 425 555 0123",
      message: "Locked idempotent retry inquiry"
    });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/reviewed details are locked for a safe retry/i);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Verify before continuing" })).toBeInTheDocument();
    expect(screen.queryByText("Locked idempotent retry inquiry")).not.toBeInTheDocument();
    expect(await currentGateWidget()).toHaveAttribute("data-cdata", submissionId);

    await completeVerification("review");
    expect(within(containerFromClass("contact-review")).getByText("Locked idempotent retry inquiry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();

    const verifyBodies = callsFor(fetchMock, "/api/contact/verify").map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)) as { submissionId: string; turnstileToken: string }
    );
    expect(verifyBodies).toHaveLength(2);
    expect(new Set(verifyBodies.map((body) => body.submissionId))).toEqual(new Set([submissionId]));
    expect(verifyBodies[0].turnstileToken).not.toBe(verifyBodies[1].turnstileToken);

    const contactBodies = callsFor(fetchMock, "/api/contact").map(([, request]) => String((request as RequestInit).body));
    expect(contactBodies).toHaveLength(3);
    expect(new Set(contactBodies).size).toBe(1);
  });

  it("offers a fresh secured identity when a two-hour draft expires and preserves reviewed details", async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = installFetchMock({
      contact: (attempt) =>
        attempt === 1
          ? Response.json({ error: "request_expired", ok: false }, { status: 409 })
          : Response.json({ ok: true })
    });
    render(<ContactPage />);
    const firstSubmissionId = await reachReview({
      email: "recruiter@example.com",
      message: "Preserve this reviewed inquiry"
    });
    acceptAcknowledgments();
    now += 2 * 60 * 60 * 1_000 + 1;

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/request expired before delivery/i);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start fresh secured request" }));

    const secondWidget = await currentGateWidget();
    const secondSubmissionId = secondWidget.getAttribute("data-cdata");
    expect(secondSubmissionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondSubmissionId).not.toBe(firstSubmissionId);
    expect(screen.queryByText("Preserve this reviewed inquiry")).not.toBeInTheDocument();

    await completeVerification("review");
    expect(within(containerFromClass("contact-review")).getByText("Preserve this reviewed inquiry")).toBeInTheDocument();
    screen.getAllByRole("checkbox").forEach((checkbox) => {
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeEnabled();
    });
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();

    const contactBodies = callsFor(fetchMock, "/api/contact").map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)) as { message: string; startedAt: number; submissionId: string }
    );
    expect(contactBodies).toEqual([
      {
        ...contactBodies[0],
        message: "Preserve this reviewed inquiry",
        startedAt: 1_700_000_000_000,
        submissionId: firstSubmissionId
      },
      {
        ...contactBodies[1],
        message: "Preserve this reviewed inquiry",
        startedAt: now,
        submissionId: secondSubmissionId
      }
    ]);
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(2);
  });

  it("warns before replacing an expired request after an ambiguous delivery attempt", async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = installFetchMock({
      contact: (attempt) => {
        if (attempt === 1) return Response.json({ error: "delivery_failed", ok: false }, { status: 502 });
        if (attempt === 2) return Response.json({ error: "request_expired", ok: false }, { status: 409 });
        return Response.json({ ok: true });
      }
    });
    render(<ContactPage />);
    const firstSubmissionId = await reachReview({ message: "Potentially partial delivery" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/locked for a safe retry/i);
    const firstBody = String((callsFor(fetchMock, "/api/contact")[0][1] as RequestInit).body);

    now += 2 * 60 * 60 * 1_000 + 1;
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/may already have been partially delivered/i);
    expect(String((callsFor(fetchMock, "/api/contact")[1][1] as RequestInit).body)).toBe(firstBody);

    fireEvent.click(screen.getByRole("button", { name: "Start fresh secured request" }));
    const nextWidget = await currentGateWidget();
    expect(nextWidget).not.toHaveAttribute("data-cdata", firstSubmissionId);
    await completeVerification("review");
    expect(within(containerFromClass("contact-review")).getByText("Potentially partial delivery")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(3);
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(2);
  });

  it("returns an unroutable email to the editable details step without another gate", async () => {
    const fetchMock = installFetchMock({
      contact: (attempt) =>
        attempt === 1
          ? Response.json({ error: "invalid_email", ok: false }, { status: 422 })
          : Response.json({ ok: true })
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@invalid.example", message: "Email validation inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn’t confirm that this email domain can receive messages/i);
    expect(screen.getByRole("heading", { name: "How can I reach you?" })).toBeInTheDocument();
    const email = screen.getByLabelText(/Email address/i);
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.blur(email);
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    fireEvent.change(email, { target: { value: "recruiter@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(2);
  });

  it("starts every subsequent message at a fresh gate with a new UUID, token, and form-start time", async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    const firstSubmissionId = await completeVerification();
    completeName();
    completeDetails({ email: "first@example.com", message: "First logical message" });
    acceptAcknowledgments();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();

    now += 120_000;
    fireEvent.click(screen.getByRole("button", { name: "Send another message" }));
    expect(screen.getByRole("heading", { name: "Verify before continuing" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
    const secondWidget = await currentGateWidget();
    const secondSubmissionId = secondWidget.getAttribute("data-cdata");
    expect(secondSubmissionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondSubmissionId).not.toBe(firstSubmissionId);

    await completeVerification();
    expect(screen.getByLabelText(/First name/i)).toHaveValue("");
    completeName("Jordan", "Lee");
    completeDetails({ email: "second@example.com", message: "Second logical message" });
    acceptAcknowledgments();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();

    const verifyBodies = callsFor(fetchMock, "/api/contact/verify").map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)) as { submissionId: string; turnstileToken: string }
    );
    expect(verifyBodies).toHaveLength(2);
    expect(verifyBodies[0].submissionId).toBe(firstSubmissionId);
    expect(verifyBodies[1].submissionId).toBe(secondSubmissionId);
    expect(verifyBodies[0].turnstileToken).not.toBe(verifyBodies[1].turnstileToken);

    const contactBodies = callsFor(fetchMock, "/api/contact").map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)) as { message: string; startedAt: number; submissionId: string }
    );
    expect(contactBodies).toHaveLength(2);
    expect(contactBodies[0]).toMatchObject({
      message: "First logical message",
      startedAt: 1_700_000_000_000,
      submissionId: firstSubmissionId
    });
    expect(contactBodies[1]).toMatchObject({
      message: "Second logical message",
      startedAt: 1_700_000_120_000,
      submissionId: secondSubmissionId
    });
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
