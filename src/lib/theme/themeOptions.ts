import type { ThemeName } from "@/lib/theme/resolveThemeName";
import { systemThemePreference, type ThemePreference } from "@/lib/theme/themePreference";

export const themeOptions = [
  { label: "Light", name: "light" },
  { label: "My mode", name: "navy" },
  { label: "Dark", name: "dark" }
] as const satisfies ReadonlyArray<{ label: string; name: ThemeName }>;

export const themePreferenceOptions = [
  { label: "System", name: systemThemePreference },
  ...themeOptions
] as const satisfies ReadonlyArray<{ label: string; name: ThemePreference }>;

export const themeLabels: Record<ThemeName, string> = {
  dark: "Dark",
  light: "Light",
  navy: "My mode"
};
