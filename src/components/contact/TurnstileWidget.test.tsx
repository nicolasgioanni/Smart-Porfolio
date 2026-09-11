import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
  const handleTokenChange = useCallback((nextToken: string) => setToken(nextToken), []);
  const handleStatusChange = useCallback((nextStatus: string) => setStatus(nextStatus), []);

  return (
    <>
      <TurnstileWidget
        cData="submission-123"
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
  window.turnstile = { render: renderMock, remove: removeMock, reset: resetMock };
});

afterEach(() => {
  cleanup();
  delete window.turnstile;
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe("TurnstileWidget", () => {
  it("runs a visible challenge on render and binds it to the current submission", async () => {
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    render(
      <TurnstileWidget
        cData="submission-123"
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
      execution: "render",
      cData: "submission-123",
      size: "flexible",
      theme: "dark",
      "response-field": false,
      retry: "never",
      "refresh-expired": "manual",
      "refresh-timeout": "manual"
    });
    expect(onStatusChange).toHaveBeenLastCalledWith("loading");
    expect(screen.getByRole("status")).toHaveTextContent(/Running secure verification/i);

    act(() => renderedOptions().callback("verified-token"));
    expect(onTokenChange).toHaveBeenLastCalledWith("verified-token");
    expect(onStatusChange).toHaveBeenLastCalledWith("ready");
    expect(screen.getByRole("status")).toHaveTextContent(/Confirming with the server/i);
  });

  it("does not overwrite a token received synchronously while rendering", async () => {
    renderMock.mockImplementationOnce((_container: HTMLElement, nextOptions: WidgetOptions) => {
      options = nextOptions;
      nextOptions.callback("immediate-token");
      return "widget-id";
    });
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();

    render(
      <TurnstileWidget
        cData="submission-123"
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        siteKey="public-site-key"
      />
    );

    await waitFor(() => expect(onTokenChange).toHaveBeenLastCalledWith("immediate-token"));
    expect(onStatusChange).toHaveBeenLastCalledWith("ready");
    expect(screen.getByRole("status")).toHaveTextContent(/Confirming with the server/i);
  });

  it("reports a controlled error when widget rendering throws and can retry rendering", async () => {
    renderMock.mockImplementationOnce(() => {
      throw new Error("Render failed.");
    });
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();

    render(
      <TurnstileWidget
        cData="submission-123"
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        siteKey="public-site-key"
      />
    );

    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith("error"));
    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("status")).toHaveTextContent(/could not run/i);

    act(() => screen.getByRole("button", { name: "Run check again" }).click());
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2));
    expect(onStatusChange).toHaveBeenLastCalledWith("loading");
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
  });

  it("clears tokens and resets after expiry, timeout, error, and unsupported callbacks", async () => {
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    render(
      <TurnstileWidget
        cData="submission-123"
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        siteKey="public-site-key"
      />
    );
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));

    act(() => renderedOptions()["expired-callback"]());
    expect(onStatusChange).toHaveBeenLastCalledWith("expired");
    expect(screen.getByRole("status")).toHaveTextContent(/Verification expired/i);

    act(() => screen.getByRole("button", { name: "Run check again" }).click());
    expect(resetMock).toHaveBeenCalledWith("widget-id");
    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(onStatusChange).toHaveBeenLastCalledWith("loading");
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());

    act(() => renderedOptions()["timeout-callback"]());
    expect(onStatusChange).toHaveBeenLastCalledWith("expired");
    act(() => renderedOptions()["error-callback"]());
    expect(onStatusChange).toHaveBeenLastCalledWith("error");
    act(() => renderedOptions()["unsupported-callback"]());
    expect(onStatusChange).toHaveBeenLastCalledWith("error");
    expect(onTokenChange).toHaveBeenLastCalledWith("");
  });

  it("does not recreate the challenge when stable callbacks update parent state", async () => {
    const { unmount } = render(<StatefulVerificationHarness />);
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));

    act(() => renderedOptions().callback("verified-token"));

    expect(screen.getByTestId("verification-state")).toHaveTextContent("ready:verified-token");
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(removeMock).not.toHaveBeenCalled();

    unmount();
    expect(removeMock).toHaveBeenCalledWith("widget-id");
  });

  it("recreates the challenge for a new submission and ignores stale callbacks", async () => {
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    const { rerender } = render(
      <TurnstileWidget
        cData="submission-123"
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        siteKey="public-site-key"
      />
    );
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));
    const firstOptions = renderedOptions();

    rerender(
      <TurnstileWidget
        cData="submission-456"
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        siteKey="public-site-key"
      />
    );

    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2));
    expect(removeMock).toHaveBeenCalledWith("widget-id");
    expect(renderedOptions().cData).toBe("submission-456");

    onStatusChange.mockClear();
    onTokenChange.mockClear();
    act(() => {
      firstOptions.callback("stale-token");
      firstOptions["expired-callback"]();
      firstOptions["error-callback"]();
    });
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(onTokenChange).not.toHaveBeenCalled();
  });

  it("fails closed without a configured site key", async () => {
    delete window.turnstile;
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    render(
      <TurnstileWidget
        cData="submission-123"
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        siteKey=""
      />
    );

    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith("unavailable"));
    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(screen.queryByTestId("turnstile-script")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/temporarily unavailable/i);
  });
});
