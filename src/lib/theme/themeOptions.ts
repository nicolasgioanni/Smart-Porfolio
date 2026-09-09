import type { ThemeName } from "@/lib/theme/resolveThemeName";

export const themeOptions = [
  { label: "Light", name: "light" },
  { label: "Gioanni", name: "navy" },
  { label: "Dark", name: "dark" }
] as const satisfies ReadonlyArray<{ label: string; name: ThemeName }>;

export const themeLabels: Record<ThemeName, string> = {
  dark: "Dark",
  light: "Light",
  navy: "Gioanni"
};
