export const themeNames = ["navy", "light", "dark"] as const;

export type ThemeName = (typeof themeNames)[number];

const themeNameSet = new Set<string>(themeNames);

export function resolveThemeName(value: unknown, fallback: ThemeName = "navy"): ThemeName {
  if (typeof value !== "string") return fallback;

  const normalizedValue = value.trim().toLowerCase();

  return themeNameSet.has(normalizedValue) ? (normalizedValue as ThemeName) : fallback;
}
