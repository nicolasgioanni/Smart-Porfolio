"use client";

import Script from "next/script";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export type TurnstileStatus = "loading" | "prepared" | "executing" | "ready" | "expired" | "error" | "unavailable";

type TurnstileTheme = "light" | "dark";

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  appearance: "interaction-only";
  execution: "execute";
  cData: string;
  size: "flexible";
  theme: TurnstileTheme;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  "timeout-callback": () => void;
  "unsupported-callback": () => void;
  "response-field": false;
  retry: "never";
  "refresh-expired": "manual";
  "refresh-timeout": "manual";
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  cData: string;
  onStatusChange: (status: TurnstileStatus) => void;
  onTokenChange: (token: string) => void;
  siteKey: string;
};

export type TurnstileWidgetHandle = {
  execute: () => boolean;
  reset: () => boolean;
};

function resolveWidgetTheme(): TurnstileTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { cData, onStatusChange, onTokenChange, siteKey },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const onStatusChangeRef = useRef(onStatusChange);
  const onTokenChangeRef = useRef(onTokenChange);
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<TurnstileStatus>(siteKey ? "loading" : "unavailable");
  const [theme, setTheme] = useState<TurnstileTheme>("dark");
  const [renderAttempt, setRenderAttempt] = useState(0);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onTokenChangeRef.current = onTokenChange;
  }, [onStatusChange, onTokenChange]);

  const updateStatus = useCallback((nextStatus: TurnstileStatus) => {
    setStatus(nextStatus);
    onStatusChangeRef.current(nextStatus);
  }, []);

  const clearToken = useCallback((nextStatus: TurnstileStatus) => {
    onTokenChangeRef.current("");
    updateStatus(nextStatus);
  }, [updateStatus]);

  const executeWidget = useCallback((): boolean => {
    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile) return false;

    onTokenChangeRef.current("");
    updateStatus("executing");
    try {
      window.turnstile.execute(widgetId);
      return true;
    } catch {
      clearToken("error");
      return false;
    }
  }, [clearToken, updateStatus]);

  const resetWidget = useCallback((): boolean => {
    const widgetId = widgetIdRef.current;
    if (!window.turnstile) {
      clearToken("unavailable");
      return false;
    }

    onTokenChangeRef.current("");
    if (widgetId) {
      try {
        window.turnstile.reset(widgetId);
        updateStatus("prepared");
        return true;
      } catch {
        clearToken("error");
        return false;
      }
    }

    updateStatus("loading");
    setRenderAttempt((current) => current + 1);
    return true;
  }, [clearToken, updateStatus]);

  useImperativeHandle(ref, () => ({ execute: executeWidget, reset: resetWidget }), [executeWidget, resetWidget]);

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

    let active = true;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
      onTokenChangeRef.current("");
    }

    updateStatus("loading");
    let widgetId: string | undefined;
    try {
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: "portfolio_contact",
        appearance: "interaction-only",
        execution: "execute",
        cData,
        size: "flexible",
        theme,
        callback: (token) => {
          if (!active) return;
          updateStatus("ready");
          onTokenChangeRef.current(token);
        },
        "expired-callback": () => {
          if (active) clearToken("expired");
        },
        "error-callback": () => {
          if (active) clearToken("error");
        },
        "timeout-callback": () => {
          if (active) clearToken("expired");
        },
        "unsupported-callback": () => {
          if (active) clearToken("error");
        },
        "response-field": false,
        retry: "never",
        "refresh-expired": "manual",
        "refresh-timeout": "manual"
      });
    } catch {
      clearToken("error");
      return;
    }

    widgetIdRef.current = widgetId;
    if (widgetId) {
      updateStatus("prepared");
    } else {
      clearToken("error");
    }

    return () => {
      active = false;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      if (widgetIdRef.current === widgetId) {
        widgetIdRef.current = undefined;
      }
    };
  }, [cData, clearToken, renderAttempt, scriptReady, siteKey, theme, updateStatus]);

  const statusMessage: Record<TurnstileStatus, string> = {
    loading: "Preparing secure verification...",
    prepared: "Security check ready. It will run when you send your request.",
    executing: "Running secure verification...",
    ready: "Security check complete. Confirming with the server...",
    expired: "Verification expired. Prepare a fresh security check to continue.",
    error: "Verification could not be prepared. Try preparing it again or use the email link below.",
    unavailable: "Secure verification is temporarily unavailable. Please refresh the page or use the email link below."
  };

  return (
    <div className="contact-turnstile" data-status={status}>
      {siteKey ? (
        <Script
          onError={() => clearToken("unavailable")}
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
            Prepare check again
          </button>
        ) : null}
      </div>
    </div>
  );
});
