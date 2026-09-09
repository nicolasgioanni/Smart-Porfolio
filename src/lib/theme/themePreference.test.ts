import { describe, expect, it } from "vitest";
import {
  resolveEffectiveTheme,
  resolveThemePreference,
  systemThemeMediaQuery,
  systemThemePreference,
  themeStorageKey
} from "@/lib/theme/themePreference";

describe("theme preference", () => {
  it("keeps storage and system-query identifiers stable", () => {
    expect(themeStorageKey).toBe("portfolio-theme");
    expect(systemThemeMediaQuery).toBe("(prefers-color-scheme: dark)");
    expect(systemThemePreference).toBe("system");
  });

  it.each([
    ["light", "light"],
    [" NAVY ", "navy"],
    ["Dark", "dark"]
  ] as const)("resolves the explicit %s preference", (value, expected) => {
    expect(resolveThemePreference(value)).toBe(expected);
  });

  it.each([null, undefined, "", "unsupported", 42])(
    "treats a missing or invalid %s preference as system-controlled",
    (value) => {
      expect(resolveThemePreference(value)).toBe("system");
    }
  );

  it("maps system dark and light preferences without creating another palette", () => {
    expect(resolveEffectiveTheme("system", true, "navy")).toBe("dark");
    expect(resolveEffectiveTheme("system", false, "navy")).toBe("light");
    expect(resolveEffectiveTheme("system", null, "navy")).toBe("navy");
  });

  it("lets every explicit palette override the system preference", () => {
    expect(resolveEffectiveTheme("light", true, "navy")).toBe("light");
    expect(resolveEffectiveTheme("navy", false, "dark")).toBe("navy");
    expect(resolveEffectiveTheme("dark", false, "navy")).toBe("dark");
  });
});
