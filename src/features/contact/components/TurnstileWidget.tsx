"use client";

import Script from "next/script";
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type TurnstileStatus = "loading" | "ready" | "expired" | "error" | "unavailable";

type TurnstileTheme = "light" | "dark";

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  appearance: "always";
  execution: "render";
  cData: string;
  size: "normal" | "compact";
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
  onStatusChange?: (status: TurnstileStatus) => void;
  onTokenChange: (token: string) => void;
  serverVerified?: boolean;
  siteKey: string;
};

function resolveWidgetTheme(): TurnstileTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function TurnstileWidget({ cData, onStatusChange, onTokenChange, serverVerified = false, siteKey }: TurnstileWidgetProps) {
  const measurementRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const onStatusChangeRef = useRef(onStatusChange);
  const onTokenChangeRef = useRef(onTokenChange);
  const serverVerifiedRef = useRef(serverVerified);
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<TurnstileStatus>(siteKey ? "loading" : "unavailable");
  const [theme, setTheme] = useState<TurnstileTheme>("dark");
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [size, setSize] = useState<TurnstileRenderOptions["size"]>();
  const [availableWidth, setAvailableWidth] = useState(0);

  useLayoutEffect(() => {
    serverVerifiedRef.current = serverVerified;
  }, [serverVerified]);

  useLayoutEffect(() => {
    const measurement = measurementRef.current;
    if (!measurement) return;

    const measure = (entry?: ResizeObserverEntry) => {
      const width = entry?.contentBoxSize?.[0]?.inlineSize ?? entry?.contentRect.width ?? measurement.clientWidth;
      setAvailableWidth(width);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => measure(entry));
    observer.observe(measurement);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!serverVerified && availableWidth > 0) {
      setSize(availableWidth < 300 ? "compact" : "normal");
    }
  }, [availableWidth, serverVerified]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onTokenChangeRef.current = onTokenChange;
  }, [onStatusChange, onTokenChange]);

  const updateStatus = useCallback((nextStatus: TurnstileStatus) => {
    setStatus(nextStatus);
    onStatusChangeRef.current?.(nextStatus);
  }, []);

  const clearToken = useCallback((nextStatus: TurnstileStatus) => {
    onTokenChangeRef.current("");
    updateStatus(nextStatus);
  }, [updateStatus]);

  const focusStatus = useCallback(() => {
    const focus = () => statusRef.current?.focus();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focus);
    } else {
      window.setTimeout(focus, 0);
    }
  }, []);

  const resetWidget = useCallback((): boolean => {
    if (serverVerifiedRef.current) return false;

    const widgetId = widgetIdRef.current;
    if (!window.turnstile) {
      clearToken("unavailable");
      return false;
    }

    onTokenChangeRef.current("");
    if (widgetId) {
      try {
        updateStatus("loading");
        window.turnstile.reset(widgetId);
        focusStatus();
        return true;
      } catch {
        clearToken("error");
        return false;
      }
    }

    updateStatus("loading");
    setRenderAttempt((current) => current + 1);
    focusStatus();
    return true;
  }, [clearToken, focusStatus, updateStatus]);

  useEffect(() => {
    setTheme(resolveWidgetTheme());

    const observer = new MutationObserver(() => {
      if (!serverVerifiedRef.current) setTheme(resolveWidgetTheme());
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

    if (!scriptReady || !size || !containerRef.current || !window.turnstile) return;

    let active = true;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
      onTokenChangeRef.current("");
    }

    updateStatus("loading");
    let widgetId: string | undefined;
    let tokenReceivedDuringRender = false;
    try {
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: "portfolio_contact",
        appearance: "always",
        execution: "render",
        cData,
        size,
        theme,
        callback: (token) => {
          if (!active || serverVerifiedRef.current) return;
          tokenReceivedDuringRender = true;
          updateStatus("ready");
          onTokenChangeRef.current(token);
        },
        "expired-callback": () => {
          if (active && !serverVerifiedRef.current) clearToken("expired");
        },
        "error-callback": () => {
          if (active && !serverVerifiedRef.current) clearToken("error");
        },
        "timeout-callback": () => {
          if (active && !serverVerifiedRef.current) clearToken("expired");
        },
        "unsupported-callback": () => {
          if (active && !serverVerifiedRef.current) clearToken("error");
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
    if (!widgetId) {
      clearToken("error");
    } else if (!tokenReceivedDuringRender) {
      updateStatus("loading");
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
  }, [cData, clearToken, renderAttempt, scriptReady, siteKey, size, theme, updateStatus]);

  const statusMessage: Record<TurnstileStatus, string> = {
    loading: "Running secure verification...",
    ready: "Confirming with the server...",
    expired: "Verification expired. Run a fresh check.",
    error: "Verification could not run. Try again.",
    unavailable: "Verification is temporarily unavailable."
  };
  const retryAvailable = status === "expired" || status === "error";
  const nativeWidth = size === "compact" ? 150 : 300;
  const nativeHeight = size === "compact" ? 140 : 65;
  const presentationScale = serverVerified && size === "normal" && availableWidth > 0
    ? Math.min(1, availableWidth / nativeWidth)
    : 1;
  const widgetPresentationStyle = {
    "--contact-turnstile-native-width": `${nativeWidth}px`,
    "--contact-turnstile-native-height": `${nativeHeight}px`,
    "--contact-turnstile-presentation-scale": String(presentationScale)
  } as CSSProperties;

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
      <div className="contact-turnstile__group">
        <div className="contact-turnstile__measurement" ref={measurementRef}>
          <div className="contact-turnstile__widget-frame" style={widgetPresentationStyle}>
            <div className="contact-turnstile__widget" data-size={size} ref={containerRef} />
          </div>
        </div>
        {!serverVerified ? (
          <>
            <div className="contact-turnstile__status-row">
              <p aria-atomic="true" aria-live="polite" ref={statusRef} role="status" tabIndex={-1}>
                <span className="contact-turnstile__status-label">{statusMessage[status]}</span>
              </p>
            </div>
            {retryAvailable ? (
              <button className="contact-text-button" onClick={resetWidget} type="button">
                Run check again
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
