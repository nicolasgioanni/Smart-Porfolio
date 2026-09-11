import { describe, expect, it } from "vitest";
import { themeLabels, themeOptions, themePreferenceOptions } from "@/lib/theme/themeOptions";

describe("theme options", () => {
  it("presents the personalized name while preserving stable theme identifiers", () => {
    expect(themeOptions).toEqual([
      { label: "Light", name: "light" },
      { label: "My mode", name: "navy" },
      { label: "Dark", name: "dark" }
    ]);
    expect(themePreferenceOptions).toEqual([
      { label: "System", name: "system" },
      { label: "Light", name: "light" },
      { label: "My mode", name: "navy" },
      { label: "Dark", name: "dark" }
    ]);
    expect(themeLabels).toEqual({ dark: "Dark", light: "Light", navy: "My mode" });
  });
});
