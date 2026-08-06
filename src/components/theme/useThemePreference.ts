"use client";

import { useCallback, useEffect, useState } from "react";
import { resolveThemeName, type ThemeName } from "@/lib/theme/resolveThemeName";
import { themeStorageKey } from "@/lib/theme/themePreference";

function readStoredTheme(initialTheme: ThemeName): ThemeName {
  const documentTheme = resolveThemeName(document.documentElement.dataset.theme, initialTheme);

  try {
    return resolveThemeName(window.localStorage.getItem(themeStorageKey), documentTheme);
  } catch {
    return documentTheme;
  }
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

export function useThemePreference(initialTheme: ThemeName) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>(initialTheme);

  useEffect(() => {
    const storedTheme = readStoredTheme(initialTheme);
    setSelectedTheme(storedTheme);
    applyTheme(storedTheme);

    function handleStorage(event: StorageEvent) {
      if (event.key !== themeStorageKey) return;

      const nextTheme = resolveThemeName(event.newValue, initialTheme);
      setSelectedTheme(nextTheme);
      applyTheme(nextTheme);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [initialTheme]);

  const updateTheme = useCallback((theme: ThemeName) => {
    setSelectedTheme(theme);
    applyTheme(theme);

    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Theme changes remain fully functional when browser storage is unavailable.
    }
  }, []);

  return { selectedTheme, updateTheme };
}
