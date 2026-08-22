import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { TurnstileWidget } from "@/components/contact/TurnstileWidget";

vi.mock("next/script", () => ({
  default: ({ src }: { src: string }) => <span data-script-src={src} data-testid="turnstile-script" />
}));

type WidgetOptions = Parameters<NonNullable<Window["turnstile"]>["render"]>[1];
type TurnstileApi = NonNullable<Window["turnstile"]>;

let options: WidgetOptions | undefined;
let renderMock: Mock<TurnstileApi["render"]>;
let removeMock: Mock<TurnstileApi["remove"]>;
let resetMock: Mock<TurnstileApi["reset"]>;

function renderedOptions(): WidgetOptions {
  if (!options) throw new Error("Expected Turnstile render options.");
  return options;
}

function StatefulVerificationHarness() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("loading");
  const handleTokenChange = useCallback(async (nextToken: string) => {
    setToken(nextToken);
  }, []);
  const handleStatusChange = useCallback((nextStatus: string) => {
    setStatus(nextStatus);
  }, []);

  return (
    <>
      <TurnstileWidget
        onStatusChange={handleStatusChange}
        onTokenChange={handleTokenChange}
        siteKey="public-site-key"
      />
      <output data-testid="verification-state">{status}:{token}</output>
    </>
  );
}

beforeEach(() => {
  options = undefined;
  document.documentElement.dataset.theme = "dark";
  renderMock = vi.fn((_container: HTMLElement, nextOptions: WidgetOptions) => {
    options = nextOptions;
    return "widget-id";
  });
  removeMock = vi.fn();
  resetMock = vi.fn();
  window.turnstile = {
    render: renderMock,
    remove: removeMock,
    reset: resetMock
  };
});

afterEach(() => {
  cleanup();
  delete window.turnstile;
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe("TurnstileWidget", () => {
  it("renders an explicit, theme-aware contact challenge and reports a successful token", async () => {
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    render(
      <TurnstileWidget
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        siteKey="public-site-key"
      />
    );

    expect(screen.getByTestId("turnstile-script")).toHaveAttribute(
      "data-script-src",
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    );
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));
    expect(renderedOptions()).toMatchObject({
      sitekey: "public-site-key",
      action: "portfolio_contact",
      appearance: "always",
      size: "flexible",
      theme: "dark",
      "response-field": false
    });

    act(() => renderedOptions().callback("verified-token"));
    expect(onTokenChange).toHaveBeenLastCalledWith("verified-token");
    expect(onStatusChange).toHaveBeenLastCalledWith("ready");
    expect(screen.getByRole("status")).toHaveTextContent("Security check complete. Confirming with the server...");
  });

  it("does not recreate the challenge when stable callbacks update parent verification state", async () => {
    const { unmount } = render(<StatefulVerificationHarness />);
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));

    await act(async () => renderedOptions().callback("verified-token"));

    expect(screen.getByTestId("verification-state")).toHaveTextContent("ready:verified-token");
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(removeMock).not.toHaveBeenCalled();

    unmount();
    expect(removeMock).toHaveBeenCalledWith("widget-id");
  });

  it("clears expired tokens and lets the visitor reset the same widget", async () => {
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    const { unmount } = render(
      <TurnstileWidget
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        siteKey="public-site-key"
      />
    );
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));

    act(() => renderedOptions()["expired-callback"]());
    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(onStatusChange).toHaveBeenLastCalledWith("expired");
    expect(screen.getByRole("status")).toHaveTextContent(/Verification expired/i);

    fireEvent.click(screen.getByRole("button", { name: "Run check again" }));
    expect(resetMock).toHaveBeenCalledWith("widget-id");
    expect(onStatusChange).toHaveBeenLastCalledWith("loading");

    unmount();
    expect(removeMock).toHaveBeenCalledWith("widget-id");
  });

  it("fails closed without a configured site key", async () => {
    delete window.turnstile;
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    render(<TurnstileWidget onStatusChange={onStatusChange} onTokenChange={onTokenChange} siteKey="" />);

    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith("unavailable"));
    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(screen.queryByTestId("turnstile-script")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/temporarily unavailable/i);
  });
});
