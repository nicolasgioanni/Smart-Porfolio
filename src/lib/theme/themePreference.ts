import { themeNames, type ThemeName } from "@/lib/theme/resolveThemeName";

export const themeStorageKey = "portfolio-theme";
export const systemThemeMediaQuery = "(prefers-color-scheme: dark)";
export const systemThemePreference = "system" as const;

export type ThemePreference = ThemeName | typeof systemThemePreference;

const themeNameSet = new Set<string>(themeNames);

export function resolveThemePreference(value: unknown): ThemePreference {
  if (typeof value !== "string") return systemThemePreference;

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === systemThemePreference) return systemThemePreference;
  return themeNameSet.has(normalizedValue) ? (normalizedValue as ThemeName) : systemThemePreference;
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean | null,
  fallback: ThemeName
): ThemeName {
  if (preference !== systemThemePreference) return preference;
  if (systemPrefersDark === null) return fallback;

  return systemPrefersDark ? "dark" : "light";
}
