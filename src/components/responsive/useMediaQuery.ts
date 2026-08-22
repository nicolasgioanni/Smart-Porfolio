"use client";

import { useCallback, useSyncExternalStore } from "react";

export const MOBILE_UI_QUERY = "(max-width: 980px)";
export const PHONE_HERO_QUERY = "(max-width: 720px)";

function getServerSnapshot(): boolean {
  return false;
}

function getMediaQuerySnapshot(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

function subscribeToMediaQuery(query: string, onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;

  const mediaQuery = window.matchMedia(query);
  const handleChange = () => onStoreChange();

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
}

/**
 * Observes a layout media query without making the server-rendered markup depend
 * on browser-only viewport state. CSS remains responsible for first paint; this
 * hook is for behavior that must change when the rendered layout mode changes.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToMediaQuery(query, onStoreChange),
    [query]
  );
  const getSnapshot = useCallback(() => getMediaQuerySnapshot(query), [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
