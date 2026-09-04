import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRef, useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle
} from "@/components/contact/TurnstileWidget";

vi.mock("next/script", () => ({
  default: ({ src }: { src: string }) => <span data-script-src={src} data-testid="turnstile-script" />
}));

type WidgetOptions = Parameters<NonNullable<Window["turnstile"]>["render"]>[1];
type TurnstileApi = NonNullable<Window["turnstile"]>;

let options: WidgetOptions | undefined;
let executeMock: Mock<TurnstileApi["execute"]>;
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
  const handleTokenChange = useCallback((nextToken: string) => {
    setToken(nextToken);
  }, []);
  const handleStatusChange = useCallback((nextStatus: string) => {
    setStatus(nextStatus);
  }, []);

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
  executeMock = vi.fn();
  renderMock = vi.fn((_container: HTMLElement, nextOptions: WidgetOptions) => {
    options = nextOptions;
    return "widget-id";
  });
  removeMock = vi.fn();
  resetMock = vi.fn();
  window.turnstile = {
    execute: executeMock,
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
  it("prepares an interaction-only challenge bound to the current submission", async () => {
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
      appearance: "interaction-only",
      execution: "execute",
      cData: "submission-123",
      size: "flexible",
      theme: "dark",
      "response-field": false,
      retry: "never",
      "refresh-expired": "manual",
      "refresh-timeout": "manual"
    });
    expect(onStatusChange).toHaveBeenLastCalledWith("prepared");
    expect(screen.getByRole("status")).toHaveTextContent(/will run when you send/i);
  });

  it("executes and resets the prepared widget through its imperative handle", async () => {
    const widgetRef = createRef<TurnstileWidgetHandle>();
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    render(
      <TurnstileWidget
        cData="submission-123"
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        ref={widgetRef}
        siteKey="public-site-key"
      />
    );
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));

    let executed = false;
    act(() => {
      executed = widgetRef.current?.execute() ?? false;
    });
    expect(executed).toBe(true);
    expect(executeMock).toHaveBeenCalledWith("widget-id");
    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(onStatusChange).toHaveBeenLastCalledWith("executing");
    expect(screen.getByRole("status")).toHaveTextContent(/Running secure verification/i);

    act(() => renderedOptions().callback("verified-token"));
    expect(onTokenChange).toHaveBeenLastCalledWith("verified-token");
    expect(onStatusChange).toHaveBeenLastCalledWith("ready");

    let reset = false;
    act(() => {
      reset = widgetRef.current?.reset() ?? false;
    });
    expect(reset).toBe(true);
    expect(resetMock).toHaveBeenCalledWith("widget-id");
    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(onStatusChange).toHaveBeenLastCalledWith("prepared");
  });

  it("reports a controlled error when widget rendering throws", async () => {
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
    expect(screen.getByRole("status")).toHaveTextContent(/could not be prepared/i);

    act(() => screen.getByRole("button", { name: "Prepare check again" }).click());
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2));
    expect(onStatusChange).toHaveBeenLastCalledWith("prepared");
  });

  it("fails closed when imperative execution throws", async () => {
    executeMock.mockImplementationOnce(() => {
      throw new Error("Execution failed.");
    });
    const widgetRef = createRef<TurnstileWidgetHandle>();
    const onStatusChange = vi.fn();
    const onTokenChange = vi.fn();
    render(
      <TurnstileWidget
        cData="submission-123"
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        ref={widgetRef}
        siteKey="public-site-key"
      />
    );
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));

    let executed = true;
    act(() => {
      executed = widgetRef.current?.execute() ?? true;
    });

    expect(executed).toBe(false);
    expect(onTokenChange).toHaveBeenLastCalledWith("");
    expect(onStatusChange).toHaveBeenLastCalledWith("error");
    expect(screen.getByRole("status")).toHaveTextContent(/could not be prepared/i);
  });

  it("clears tokens and reports expiry, timeout, error, and unsupported callbacks", async () => {
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

    act(() => screen.getByRole("button", { name: "Prepare check again" }).click());
    expect(resetMock).toHaveBeenCalledWith("widget-id");
    expect(onStatusChange).toHaveBeenLastCalledWith("prepared");

    act(() => renderedOptions()["timeout-callback"]());
    expect(onStatusChange).toHaveBeenLastCalledWith("expired");

    act(() => renderedOptions()["error-callback"]());
    expect(onStatusChange).toHaveBeenLastCalledWith("error");

    act(() => renderedOptions()["unsupported-callback"]());
    expect(onStatusChange).toHaveBeenLastCalledWith("error");
    expect(onTokenChange).toHaveBeenLastCalledWith("");
  });

  it("does not recreate the challenge when stable callbacks update parent verification state", async () => {
    const { unmount } = render(<StatefulVerificationHarness />);
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));

    act(() => renderedOptions().callback("verified-token"));

    expect(screen.getByTestId("verification-state")).toHaveTextContent("ready:verified-token");
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(removeMock).not.toHaveBeenCalled();

    unmount();
    expect(removeMock).toHaveBeenCalledWith("widget-id");
  });

  it("recreates the widget when a new submission identifier is supplied", async () => {
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
