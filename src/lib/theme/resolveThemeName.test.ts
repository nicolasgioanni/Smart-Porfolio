import { describe, expect, it } from "vitest";
import { resolveThemeName, themeNames } from "@/lib/theme/resolveThemeName";

describe("resolveThemeName", () => {
  it("accepts supported theme names case-insensitively", () => {
    expect(themeNames).toEqual(["navy", "light", "dark"]);
    expect(resolveThemeName("Navy")).toBe("navy");
    expect(resolveThemeName(" light ")).toBe("light");
    expect(resolveThemeName("DARK")).toBe("dark");
  });

  it("falls back to navy for unsupported or missing values", () => {
    expect(resolveThemeName(undefined)).toBe("navy");
    expect(resolveThemeName("purple")).toBe("navy");
    expect(resolveThemeName("purple", "dark")).toBe("dark");
  });
});
