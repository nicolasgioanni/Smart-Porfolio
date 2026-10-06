import { describe, expect, it } from "vitest";
import { formatExperienceDuration, isCurrentExperienceEndDate } from "@/lib/content/experienceDuration";

describe("experience duration formatting", () => {
  it("uses inclusive calendar-month durations with compact singular and plural labels", () => {
    expect(formatExperienceDuration("2026-10", "2026-10")).toBe("1 mo");
    expect(formatExperienceDuration("2026-08", "2026-10")).toBe("3 mos");
    expect(formatExperienceDuration("2025-11", "2026-10")).toBe("1 yr");
    expect(formatExperienceDuration("2024-10", "2026-10")).toBe("2 yrs 1 mo");
  });

  it("uses the supplied browser-local calendar month for current roles and omits invalid or reversed ranges", () => {
    expect(formatExperienceDuration("2026-10", undefined, { year: 2026, month: 10 })).toBe("1 mo");
    expect(formatExperienceDuration("2026-11", "2026-10")).toBeUndefined();
    expect(formatExperienceDuration("October 2026", "2026-10")).toBeUndefined();
    expect(isCurrentExperienceEndDate("Present")).toBe(true);
    expect(isCurrentExperienceEndDate("2026-10")).toBe(false);
  });
});
