"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveThemeName, type ThemeName } from "@/lib/theme/resolveThemeName";
import {
  resolveEffectiveTheme,
  resolveThemePreference,
  systemThemeMediaQuery,
  systemThemePreference,
  themeStorageKey,
  type ThemePreference
} from "@/lib/theme/themePreference";

type ThemePreferenceState = {
  selectedPreference: ThemePreference;
  selectedTheme: ThemeName;
};

function readStoredPreference(): ThemePreference {
  try {
    return resolveThemePreference(window.localStorage.getItem(themeStorageKey));
  } catch {
    return systemThemePreference;
  }
}

function readSystemMediaQuery(): MediaQueryList | null {
  try {
    return typeof window.matchMedia === "function" ? window.matchMedia(systemThemeMediaQuery) : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

export function useThemePreference(initialTheme: ThemeName) {
  const [themeState, setThemeState] = useState<ThemePreferenceState>({
    selectedPreference: initialTheme,
    selectedTheme: initialTheme
  });
  const selectedPreferenceRef = useRef<ThemePreference>(initialTheme);

  const commitPreference = useCallback(
    (selectedPreference: ThemePreference, systemPrefersDark: boolean | null, fallback = initialTheme) => {
      const selectedTheme = resolveEffectiveTheme(selectedPreference, systemPrefersDark, fallback);
      selectedPreferenceRef.current = selectedPreference;
      setThemeState({ selectedPreference, selectedTheme });
      applyTheme(selectedTheme);
    },
    [initialTheme]
  );

  useEffect(() => {
    const documentTheme = resolveThemeName(document.documentElement.dataset.theme, initialTheme);
    const mediaQuery = readSystemMediaQuery();
    const storedPreference = readStoredPreference();

    commitPreference(storedPreference, mediaQuery?.matches ?? null, documentTheme);

    function handleSystemPreferenceChange(event: MediaQueryListEvent) {
      if (selectedPreferenceRef.current !== systemThemePreference) return;

      commitPreference(systemThemePreference, event.matches);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== themeStorageKey && event.key !== null) return;

      const nextPreference = resolveThemePreference(event.key === null ? null : event.newValue);
      commitPreference(nextPreference, mediaQuery?.matches ?? null);
    }

    if (typeof mediaQuery?.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemPreferenceChange);
    } else {
      mediaQuery?.addListener?.(handleSystemPreferenceChange);
    }
    window.addEventListener("storage", handleStorage);

    return () => {
      if (typeof mediaQuery?.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleSystemPreferenceChange);
      } else {
        mediaQuery?.removeListener?.(handleSystemPreferenceChange);
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, [commitPreference, initialTheme]);

  const updateThemePreference = useCallback(
    (preference: ThemePreference) => {
      const mediaQuery = readSystemMediaQuery();
      commitPreference(preference, mediaQuery?.matches ?? null);

      try {
        if (preference === systemThemePreference) {
          window.localStorage.removeItem(themeStorageKey);
        } else {
          window.localStorage.setItem(themeStorageKey, preference);
        }
      } catch {
        // Theme changes remain fully functional for this visit when storage is unavailable.
      }
    },
    [commitPreference]
  );

  return { ...themeState, updateThemePreference };
}
