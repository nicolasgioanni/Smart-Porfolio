import { describe, expect, it } from "vitest";
import { themeLabels, themeOptions } from "@/lib/theme/themeOptions";

describe("theme options", () => {
  it("presents the personalized name while preserving stable theme identifiers", () => {
    expect(themeOptions).toEqual([
      { label: "Light", name: "light" },
      { label: "Gioanni", name: "navy" },
      { label: "Dark", name: "dark" }
    ]);
    expect(themeLabels).toEqual({ dark: "Dark", light: "Light", navy: "Gioanni" });
  });
});
