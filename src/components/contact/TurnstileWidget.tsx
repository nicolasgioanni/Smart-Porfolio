"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

export type TurnstileStatus = "loading" | "ready" | "expired" | "error" | "unavailable";

type TurnstileTheme = "light" | "dark";

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  appearance: "always";
  size: "flexible";
  theme: TurnstileTheme;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  "timeout-callback": () => void;
  "unsupported-callback": () => void;
  "response-field": false;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  onStatusChange: (status: TurnstileStatus) => void;
  onTokenChange: (token: string) => void;
  siteKey: string;
};

function resolveWidgetTheme(): TurnstileTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function TurnstileWidget({ onStatusChange, onTokenChange, siteKey }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<TurnstileStatus>(siteKey ? "loading" : "unavailable");
  const [theme, setTheme] = useState<TurnstileTheme>("dark");

  const updateStatus = useCallback(
    (nextStatus: TurnstileStatus) => {
      setStatus(nextStatus);
      onStatusChange(nextStatus);
    },
    [onStatusChange]
  );

  const clearToken = useCallback(
    (nextStatus: TurnstileStatus) => {
      onTokenChange("");
      updateStatus(nextStatus);
    },
    [onTokenChange, updateStatus]
  );

  const resetWidget = useCallback(() => {
    onTokenChange("");
    updateStatus("loading");

    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [onTokenChange, updateStatus]);

  useEffect(() => {
    setTheme(resolveWidgetTheme());

    const observer = new MutationObserver(() => {
      setTheme(resolveWidgetTheme());
    });

    observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.turnstile) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!siteKey) {
      clearToken("unavailable");
      return;
    }

    if (!scriptReady || !containerRef.current || !window.turnstile) return;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
      onTokenChange("");
    }

    updateStatus("loading");
    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "portfolio_contact",
      appearance: "always",
      size: "flexible",
      theme,
      callback: (token) => {
        onTokenChange(token);
        updateStatus("ready");
      },
      "expired-callback": () => clearToken("expired"),
      "error-callback": () => clearToken("error"),
      "timeout-callback": () => clearToken("expired"),
      "unsupported-callback": () => clearToken("error"),
      "response-field": false
    });

    widgetIdRef.current = widgetId;

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [clearToken, onTokenChange, scriptReady, siteKey, theme, updateStatus]);

  const statusMessage: Record<TurnstileStatus, string> = {
    loading: "Loading secure verification...",
    ready: "Security check complete. Confirming with the server...",
    expired: "Verification expired. Run the check again to continue.",
    error: "Verification could not complete. Run the check again or refresh the page.",
    unavailable: "Secure verification is temporarily unavailable. Please refresh the page or use the email link below."
  };

  return (
    <div className="contact-turnstile" data-status={status}>
      {siteKey ? (
        <Script
          onError={() => clearToken("error")}
          onReady={() => setScriptReady(true)}
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
        />
      ) : null}
      <div className="contact-turnstile__widget" ref={containerRef} />
      <div className="contact-turnstile__status-row">
        <p aria-live="polite" role="status">
          {statusMessage[status]}
        </p>
        {status === "expired" || status === "error" ? (
          <button className="contact-text-button" onClick={resetWidget} type="button">
            Run check again
          </button>
        ) : null}
      </div>
    </div>
  );
}
