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

const turnstileHarness = vi.hoisted(() => ({
  executions: [] as string[],
  outcomes: [] as Array<
    | { kind: "error" }
    | { kind: "expired" }
    | { kind: "interaction" }
    | { kind: "rejected-execution" }
    | { kind: "token"; token?: string }
  >,
  resets: 0,
  tokenIndex: 0
}));

vi.mock("@/components/contact/TurnstileWidget", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  type MockStatus = "error" | "executing" | "expired" | "loading" | "prepared" | "ready" | "unavailable";
  type MockProps = {
    cData: string;
    onStatusChange: (status: MockStatus) => void;
    onTokenChange: (token: string) => void;
    siteKey: string;
  };
  type MockHandle = { execute: () => boolean; reset: () => boolean };

  const TurnstileWidget = React.forwardRef<MockHandle, MockProps>(function MockTurnstileWidget(
    { cData, onStatusChange, onTokenChange, siteKey },
    ref
  ) {
    const [status, setStatus] = React.useState<MockStatus>("loading");
    const statusCallbackRef = React.useRef(onStatusChange);
    const tokenCallbackRef = React.useRef(onTokenChange);
    statusCallbackRef.current = onStatusChange;
    tokenCallbackRef.current = onTokenChange;

    const reportStatus = React.useCallback((nextStatus: MockStatus) => {
      setStatus(nextStatus);
      statusCallbackRef.current(nextStatus);
    }, []);

    const issueToken = React.useCallback(
      (providedToken?: string) => {
        turnstileHarness.tokenIndex += 1;
        tokenCallbackRef.current(providedToken ?? `test-turnstile-token-${turnstileHarness.tokenIndex}`);
        reportStatus("ready");
      },
      [reportStatus]
    );

    React.useEffect(() => {
      reportStatus(siteKey ? "prepared" : "unavailable");
    }, [cData, reportStatus, siteKey]);

    React.useImperativeHandle(
      ref,
      () => ({
        execute() {
          if (!siteKey) return false;
          turnstileHarness.executions.push(cData);
          const outcome = turnstileHarness.outcomes.shift() ?? { kind: "token" as const };
          reportStatus("executing");
          if (outcome.kind === "rejected-execution") return false;
          if (outcome.kind === "error") reportStatus("error");
          if (outcome.kind === "expired") reportStatus("expired");
          if (outcome.kind === "token") issueToken(outcome.token);
          return true;
        },
        reset() {
          turnstileHarness.resets += 1;
          if (!siteKey) return false;
          reportStatus("prepared");
          return true;
        }
      }),
      [cData, issueToken, reportStatus, siteKey]
    );

    return (
      <div
        data-cdata={cData}
        data-execution="execute"
        data-site-key={siteKey}
        data-status={status}
        data-testid="turnstile-mock"
      >
        {siteKey ? (
          <>
            <button onClick={() => issueToken("interactive-turnstile-token")} type="button">
              Complete requested interaction
            </button>
            <button onClick={() => reportStatus("expired")} type="button">
              Expire security challenge
            </button>
            <button onClick={() => reportStatus("error")} type="button">
              Fail security challenge
            </button>
          </>
        ) : (
          <p role="status">Secure verification is temporarily unavailable.</p>
        )}
      </div>
    );
  });

  return { TurnstileWidget };
});

const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const originalPreviewSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
  process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY = "preview-only-test-key";
  turnstileHarness.executions.length = 0;
  turnstileHarness.outcomes.length = 0;
  turnstileHarness.resets = 0;
  turnstileHarness.tokenIndex = 0;
  installFetchMock();
});

afterEach(() => {
  if (originalSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
  if (originalPreviewSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY = originalPreviewSiteKey;
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

async function waitForPreparedWidget() {
  await waitFor(() => expect(screen.getByTestId("turnstile-mock")).toHaveAttribute("data-status", "prepared"));
}

async function reachReview(details?: Parameters<typeof completeDetails>[0]) {
  completeName();
  completeDetails(details);
  await waitForPreparedWidget();
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
  it("starts with visitor details in a three-step form and does not verify early", () => {
    const fetchMock = installFetchMock();
    const { container } = render(<ContactPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Contact" })).toBeInTheDocument();
    expect(screen.getByText(/University of Washington inbox is public and receives a high volume of email/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tell me your name" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Step 1 of 3" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.queryByTestId("turnstile-mock")).not.toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(0);
    expect(container.querySelector("form")).not.toHaveAttribute("action");
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    expect(container.textContent).not.toMatch(/preview|not enabled|coming soon|nothing entered/i);
    expect(screen.getByText(/Need another option\?/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email ngioanni@uw.edu" })).toHaveAttribute(
      "href",
      "mailto:ngioanni@uw.edu?subject=Portfolio%20Contact"
    );
  });

  it("keeps final submission unavailable when the selected build has no Turnstile key", async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    completeName();
    completeDetails();

    await waitFor(() => expect(screen.getByTestId("turnstile-mock")).toHaveAttribute("data-status", "unavailable"));
    expect(screen.getByTestId("turnstile-mock")).toHaveAttribute("data-site-key", "");
    acceptAcknowledgments();
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/secure verification is temporarily unavailable/i);
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(0);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);
  });

  it("shows accessible name and contact validation across all three steps", () => {
    render(<ContactPage />);
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
    expect(lastName).toHaveAccessibleDescription("Enter your last name");

    fireEvent.change(firstName, { target: { value: " Avery " } });
    fireEvent.change(lastName, { target: { value: " Nguyen " } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("progressbar", { name: "Step 2 of 3" })).toHaveAttribute("aria-valuenow", "2");

    const email = screen.getByLabelText(/Email address/i);
    const phone = screen.getByLabelText(/Phone number/i);
    const message = screen.getByRole("textbox", { name: /Message/i });
    expect(email).toHaveAttribute("maxlength", "254");
    expect(phone).not.toHaveAttribute("required");
    expect(phone).toHaveAttribute("maxlength", "40");
    expect(message).toHaveAttribute("maxlength", "3000");
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Enter your email address")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Enter a message")).toHaveAttribute("role", "alert");

    fireEvent.change(email, { target: { value: "invalid-email" } });
    fireEvent.change(phone, { target: { value: "123" } });
    fireEvent.change(message, { target: { value: "  Please contact me about my resume.  " } });
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid phone number")).toBeInTheDocument();

    fireEvent.change(email, { target: { value: " avery@example.com " } });
    fireEvent.change(phone, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("progressbar", { name: "Step 3 of 3" })).toHaveAttribute("aria-valuenow", "3");
    const review = containerFromClass("contact-review");
    expect(within(review).getByText("Avery Nguyen")).toBeInTheDocument();
    expect(within(review).getByText("avery@example.com")).toBeInTheDocument();
    expect(within(review).getByText("Not provided")).toBeInTheDocument();
    expect(within(review).getByText("Please contact me about my resume.")).toBeInTheDocument();
  });

  it("replays the validation shake for persistent field errors", async () => {
    render(<ContactPage />);
    const next = screen.getByRole("button", { name: "Next" });
    const form = next.closest("form");
    const firstName = screen.getByLabelText(/First name/i);
    fireEvent.click(next);
    expect(form).toHaveAttribute("data-validation-shake", "b");
    await waitFor(() => expect(firstName).toHaveFocus());
    fireEvent.click(next);
    expect(form).toHaveAttribute("data-validation-shake", "a");

    fireEvent.change(firstName, { target: { value: "Avery" } });
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: "Nguyen" } });
    fireEvent.click(next);
    const review = screen.getByRole("button", { name: "Review" });
    const email = screen.getByLabelText(/Email address/i);
    fireEvent.click(review);
    expect(form).toHaveAttribute("data-validation-shake", "b");
    await waitFor(() => expect(email).toHaveFocus());
    fireEvent.click(review);
    expect(form).toHaveAttribute("data-validation-shake", "a");
  });

  it("requires all acknowledgments before enabling final-submit verification", async () => {
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    await reachReview({ phone: "+44 20 7946 0958" });
    const submit = screen.getByRole("button", { name: "Send request" });
    const checkboxes = screen.getAllByRole("checkbox");
    const cards = checkboxes.map((checkbox) => checkbox.closest(".contact-consent-card"));
    expect(submit).toBeDisabled();
    expect(screen.getByText(/unlock Send request \(0\/3\)/)).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(0);
    if (!cards[0] || !cards[1] || !cards[2]) throw new Error("Expected three acknowledgment cards.");
    fireEvent.click(cards[0]);
    expect(screen.getByText(/unlock Send request \(1\/3\)/)).toBeInTheDocument();
    fireEvent.click(cards[1]);
    fireEvent.click(cards[2]);
    expect(screen.getByText(/All acknowledgments complete\. Send request will run the security check/i)).toBeInTheDocument();
    expect(submit).toBeEnabled();
    expect(turnstileHarness.executions).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Site Terms & Accuracy Notice" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
  });

  it("executes Turnstile only on Send, binds cData, and posts the exact locked contract", async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = installFetchMock();
    const getItemMock = vi.spyOn(Storage.prototype, "getItem");
    const setItemMock = vi.spyOn(Storage.prototype, "setItem");
    render(<ContactPage />);
    completeName("  Avery  ", "  Nguyen  ");
    completeDetails({
      email: "  avery@example.com  ",
      phone: "  +1 (425) 555-0123  ",
      message: "  Please send the resume when convenient.  "
    });
    await waitForPreparedWidget();

    const widget = screen.getByTestId("turnstile-mock");
    const cData = widget.getAttribute("data-cdata");
    expect(cData).toMatch(/^[0-9a-f-]{36}$/i);
    expect(widget).toHaveAttribute("data-execution", "execute");
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(0);
    acceptAcknowledgments();
    now += 60_000;

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1));
    expect(fetchMock.mock.calls.map(([input]) => requestUrl(input as RequestInfo | URL))).toEqual([
      "/api/contact/verify",
      "/api/contact"
    ]);
    expect(turnstileHarness.executions).toEqual([cData]);

    const verifyRequest = callsFor(fetchMock, "/api/contact/verify")[0][1] as RequestInit;
    expect(verifyRequest).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(new Headers(verifyRequest.headers).get("Accept")).toBe("application/json");
    expect(new Headers(verifyRequest.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(verifyRequest.body))).toEqual({
      submissionId: cData,
      turnstileToken: "test-turnstile-token-1"
    });

    const request = callsFor(fetchMock, "/api/contact")[0][1] as RequestInit;
    expect(request).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(new Headers(request.headers).get("Accept")).toBe("application/json");
    expect(new Headers(request.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(request.body))).toEqual({
      submissionId: cData,
      firstName: "Avery",
      lastName: "Nguyen",
      email: "avery@example.com",
      phone: "+1 (425) 555-0123",
      message: "Please send the resume when convenient.",
      contactConsent: true,
      legalConsent: true,
      legitimateConsent: true,
      startedAt: 1_700_000_000_000,
      website: ""
    });
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
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
  });

  it("supports an interactive challenge after Send without losing the reviewed fields", async () => {
    turnstileHarness.outcomes.push({ kind: "interaction" });
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    await reachReview({ email: "visitor@example.com", message: "Interactive challenge inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByText(/Running the security check.*Cloudflare requests one/i)).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(0);
    expect(within(containerFromClass("contact-review")).getByText("Interactive challenge inquiry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Complete requested interaction" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();
    const verifyBody = JSON.parse(String((callsFor(fetchMock, "/api/contact/verify")[0][1] as RequestInit).body)) as {
      turnstileToken: string;
    };
    expect(verifyBody.turnstileToken).toBe("interactive-turnstile-token");
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
  });

  it.each([
    ["error", /security check could not complete/i],
    ["expired", /security check expired before it completed/i]
  ] as const)("recovers from a Turnstile %s without discarding entered fields", async (kind, expectedCopy) => {
    turnstileHarness.outcomes.push({ kind });
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    await reachReview({ email: "visitor@example.com", message: "Challenge recovery inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expectedCopy);
    expect(within(containerFromClass("contact-review")).getByText("Challenge recovery inquiry")).toBeInTheDocument();
    screen.getAllByRole("checkbox").forEach((checkbox) => {
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeEnabled();
    });
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(0);
    await waitForPreparedWidget();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();
    expect(turnstileHarness.executions).toHaveLength(2);
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
  });

  it.each([
    ["verification_failed", 400, /security check was invalid or expired/i],
    ["verification_unavailable", 503, /Secure verification is temporarily unavailable/i]
  ] as const)("recovers from %s while retaining the reviewed draft", async (error, status, expectedCopy) => {
    const fetchMock = installFetchMock({
      verify: (attempt) =>
        attempt === 1 ? Response.json({ error, ok: false }, { status }) : Response.json({ ok: true })
    });
    render(<ContactPage />);
    await reachReview({ email: "visitor@example.com", message: "Server verification recovery" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expectedCopy);
    expect(within(containerFromClass("contact-review")).getByText("Server verification recovery")).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);
    await waitForPreparedWidget();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(2);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
  });

  it("blocks repeated Send actions while verification is pending", async () => {
    const pendingVerification = deferred<Response>();
    const fetchMock = installFetchMock({ verify: () => pendingVerification.promise });
    render(<ContactPage />);
    await reachReview({ message: "Please process this only once." });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1));
    const busySend = screen.getByRole("button", { name: "Verifying request..." });
    expect(busySend).toBeDisabled();
    fireEvent.click(busySend);
    expect(turnstileHarness.executions).toHaveLength(1);
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(0);

    await act(async () => pendingVerification.resolve(Response.json({ ok: true })));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
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
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be delivered.*verification remains complete/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/reviewed details are locked for a safe retry/i);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeDisabled());

    const firstRequest = callsFor(fetchMock, "/api/contact")[0][1] as RequestInit;
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();

    const contactCalls = callsFor(fetchMock, "/api/contact");
    expect(contactCalls).toHaveLength(2);
    expect(String((contactCalls[1][1] as RequestInit).body)).toBe(String(firstRequest.body));
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
    expect(turnstileHarness.executions).toHaveLength(1);
  });

  it("runs fresh verification for an expired retry ticket without changing the locked delivery", async () => {
    const fetchMock = installFetchMock({
      contact: (attempt) => {
        if (attempt === 1) return Response.json({ error: "delivery_failed", ok: false }, { status: 502 });
        if (attempt === 2) return Response.json({ error: "verification_required", ok: false }, { status: 401 });
        return Response.json({ ok: true });
      }
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

    expect(await screen.findByRole("alert")).toHaveTextContent(/verification session expired.*reviewed details remain locked/i);
    expect(within(containerFromClass("contact-review")).getByText("Locked idempotent retry inquiry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeDisabled());
    await waitForPreparedWidget();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();

    const verifyBodies = callsFor(fetchMock, "/api/contact/verify").map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)) as { submissionId: string; turnstileToken: string }
    );
    expect(verifyBodies).toHaveLength(2);
    expect(verifyBodies[0].submissionId).toBe(verifyBodies[1].submissionId);
    expect(verifyBodies[0].turnstileToken).not.toBe(verifyBodies[1].turnstileToken);
    expect(new Set(turnstileHarness.executions)).toEqual(new Set([verifyBodies[0].submissionId]));

    const contactBodies = callsFor(fetchMock, "/api/contact").map(([, request]) => String((request as RequestInit).body));
    expect(contactBodies).toHaveLength(3);
    expect(new Set(contactBodies).size).toBe(1);
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
    expect(alert).toHaveTextContent(/couldn’t confirm that this email domain can receive messages/i);
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

  it("shows the two-per-day limit and Retry-After timing without locking edits", async () => {
    const fetchMock = installFetchMock({
      contact: () =>
        Response.json({ error: "rate_limited", ok: false }, { status: 429, headers: { "Retry-After": "3600" } })
    });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", message: "Rate limit inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/limit of 2 submissions within 24 hours/i);
    expect(alert).toHaveTextContent(/try again in about 1 hour/i);
    expect(screen.getByRole("heading", { name: "How can I reach you?" })).toBeInTheDocument();
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
  });

  it.each([
    ["email_validation_unavailable", /Email validation is temporarily unavailable/i],
    ["service_unavailable", /contact service is temporarily unavailable/i]
  ])("keeps %s retryable and editable because delivery did not begin", async (error, expectedCopy) => {
    installFetchMock({ contact: () => Response.json({ error, ok: false }, { status: 503 }) });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", message: "Temporary service inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(expectedCopy);
    expect(alert).toHaveTextContent(/request was not sent/i);
    expect(screen.getByRole("heading", { name: "Review your request" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
    screen.getAllByRole("checkbox").forEach((checkbox) => expect(checkbox).toBeEnabled());
  });

  it("keeps the verified frozen review after a network failure", async () => {
    const fetchMock = installFetchMock({ contact: () => Promise.reject(new Error("network unavailable")) });
    render(<ContactPage />);
    await reachReview({ email: "recruiter@example.com", message: "Network retry inquiry" });
    acceptAcknowledgments();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the delivery service.*verification remains complete/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/reviewed details are locked for a safe retry/i);
    expect(within(containerFromClass("contact-review")).getByText("Network retry inquiry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(callsFor(fetchMock, "/api/contact/verify")).toHaveLength(1);
    expect(callsFor(fetchMock, "/api/contact")).toHaveLength(1);
  });

  it("starts a subsequent message with a fresh UUID, token, payload, and form-start time", async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = installFetchMock();
    render(<ContactPage />);
    await reachReview({ email: "first@example.com", message: "First logical message" });
    acceptAcknowledgments();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();

    now += 120_000;
    fireEvent.click(screen.getByRole("button", { name: "Send another message" }));
    expect(screen.getByRole("heading", { name: "Tell me your name" })).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/i)).toHaveValue("");
    completeName("Jordan", "Lee");
    completeDetails({ email: "second@example.com", message: "Second logical message" });
    await waitForPreparedWidget();
    acceptAcknowledgments();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out" })).toBeInTheDocument();

    const verifyBodies = callsFor(fetchMock, "/api/contact/verify").map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)) as { submissionId: string; turnstileToken: string }
    );
    expect(verifyBodies).toHaveLength(2);
    expect(verifyBodies[0].submissionId).not.toBe(verifyBodies[1].submissionId);
    expect(verifyBodies[0].turnstileToken).not.toBe(verifyBodies[1].turnstileToken);
    expect(turnstileHarness.executions).toEqual(verifyBodies.map((body) => body.submissionId));

    const contactBodies = callsFor(fetchMock, "/api/contact").map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)) as { message: string; startedAt: number; submissionId: string }
    );
    expect(contactBodies).toHaveLength(2);
    expect(contactBodies[0]).toMatchObject({ message: "First logical message", startedAt: 1_700_000_000_000 });
    expect(contactBodies[1]).toMatchObject({ message: "Second logical message", startedAt: 1_700_000_120_000 });
    expect(contactBodies[0].submissionId).not.toBe(contactBodies[1].submissionId);
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
