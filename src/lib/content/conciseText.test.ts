import { describe, expect, it } from "vitest";
import { splitFirstSentence } from "@/lib/content/conciseText";
import { getHomeMobileSummary } from "@/lib/content/homeMobileSummaries";

describe("concise presentation copy", () => {
  it.each([
    ["One sentence. Another follows.", "One sentence. "],
    ["Version 2.0 worked well! More detail.", "Version 2.0 worked well! "],
    ["Dr. Miller reviewed version 2.0. More detail.", "Dr. Miller reviewed version 2.0. "],
    ["“Excellent work.” He delivered.", "“Excellent work.” "],
    ["A single unpunctuated recommendation", "A single unpunctuated recommendation"],
    ["", ""]
  ])("splits the first sentence without changing the original: %s", (text, first) => {
    const parts = splitFirstSentence(text);
    expect(parts[0]).toBe(first);
    expect(parts.join("")).toBe(text);
  });

  it("uses curated short copy for established cards and authored fallback for unknown IDs", () => {
    expect(getHomeMobileSummary("research", "cytocv-miller-lab", "Desktop copy.")).toBe(
      "Turns yeast microscopy into reviewable cell measurements."
    );
    expect(getHomeMobileSummary("projects", "notepal", "Desktop copy.")).toBe(
      "Turns study materials into notes, quizzes, and AI chat."
    );
    expect(getHomeMobileSummary("projects", "new-project", "Authored context. Further detail.")).toBe("Authored context.");
    expect(getHomeMobileSummary("projects", "constructor", "Authored context.")).toBe("Authored context.");
  });
});
