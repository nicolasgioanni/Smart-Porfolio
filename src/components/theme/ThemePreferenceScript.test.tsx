import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThemePreferenceScript } from "@/components/theme/ThemePreferenceScript";
import { systemThemeMediaQuery, themeStorageKey } from "@/lib/theme/themePreference";

function setSystemPreference(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === systemThemeMediaQuery ? prefersDark : false,
      media: query
    }))
  });
}

function runPreferenceScript(initialTheme: "navy" | "light" | "dark") {
  Function(createThemePreferenceScript(initialTheme))();
  return document.documentElement.dataset.theme;
}

describe("ThemePreferenceScript", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it.each([
    [false, "light"],
    [true, "dark"]
  ] as const)("applies the system preference before hydration when dark is %s", (prefersDark, expected) => {
    setSystemPreference(prefersDark);

    expect(runPreferenceScript("navy")).toBe(expected);
  });

  it.each(["light", "navy", "dark"] as const)("keeps a stored %s override ahead of the system", (storedTheme) => {
    setSystemPreference(storedTheme !== "dark");
    window.localStorage.setItem(themeStorageKey, storedTheme);

    expect(runPreferenceScript("navy")).toBe(storedTheme);
  });

  it("treats invalid storage as automatic and still follows the system", () => {
    setSystemPreference(true);
    window.localStorage.setItem(themeStorageKey, "unsupported");

    expect(runPreferenceScript("navy")).toBe("dark");
  });

  it("normalizes a stored override before first paint just like the hydrated runtime", () => {
    setSystemPreference(false);
    window.localStorage.setItem(themeStorageKey, " DARK ");

    expect(runPreferenceScript("navy")).toBe("dark");
  });

  it("still follows the system when storage access fails", () => {
    setSystemPreference(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    expect(runPreferenceScript("navy")).toBe("light");
  });

  it("retains the generated fallback when the system query is unavailable or fails", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    expect(runPreferenceScript("navy")).toBe("navy");

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("Media query unavailable");
      })
    });
    expect(runPreferenceScript("dark")).toBe("dark");
  });
});
