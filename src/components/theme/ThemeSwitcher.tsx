"use client";

import { useEffect, useState } from "react";
import { resolveThemeName, themeNames, type ThemeName } from "@/lib/theme/resolveThemeName";

const storageKey = "portfolio-theme";

const themeLabels: Record<ThemeName, string> = {
  navy: "Navy",
  light: "Light",
  dark: "Dark"
};

type ThemeSwitcherProps = {
  initialTheme: ThemeName;
};

export function ThemeSwitcher({ initialTheme }: ThemeSwitcherProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>(initialTheme);

  useEffect(() => {
    const storedTheme = resolveThemeName(window.localStorage.getItem(storageKey), initialTheme);
    setSelectedTheme(storedTheme);
    document.documentElement.dataset.theme = storedTheme;
  }, [initialTheme]);

  function updateTheme(theme: ThemeName) {
    setSelectedTheme(theme);
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(storageKey, theme);
  }

  return (
    <div className="theme-switcher" role="group" aria-label="Theme">
      {themeNames.map((theme) => (
        <button
          aria-pressed={selectedTheme === theme}
          className="theme-switcher__button"
          key={theme}
          onClick={() => updateTheme(theme)}
          type="button"
        >
          {themeLabels[theme]}
        </button>
      ))}
    </div>
  );
}
