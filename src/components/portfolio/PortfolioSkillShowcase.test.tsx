import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PortfolioSkillShowcase } from "@/components/portfolio/PortfolioSkillShowcase";
import type { SkillItem } from "@/content/types";

const pythonSkill: SkillItem = {
  id: "skill-python",
  category: "Core Programming",
  name: "Python",
  icon: "python",
  proficiency: "Advanced",
  summary: "A versatile language for backend, automation, machine learning, and data workflows.",
  whereUsed: "Used across CytoCV, NotePal, research automation, desktop tooling, and CLIs.",
  featured: true,
  showOnHome: true,
  order: 1
};

const legacySkill: SkillItem = {
  id: "skill-git",
  category: "Core Programming",
  name: "Git",
  icon: "git",
  featured: true,
  showOnHome: true,
  order: 2
};

describe("PortfolioSkillShowcase", () => {
  it("opens recruiter-focused proficiency and usage details while preserving legacy badges", () => {
    render(<PortfolioSkillShowcase category="Core Programming" skills={[pythonSkill, legacySkill]} />);

    const list = screen.getByRole("list", { name: "Core Programming skills" });
    const trigger = within(list).getByRole("button", {
      name: "Learn about my experience with Python"
    });

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).queryByRole("button", { name: /git/i })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Python" });
    expect(within(dialog).getByText("Proficiency · Advanced")).toBeInTheDocument();
    expect(within(dialog).getByText(pythonSkill.summary!)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Where I've used it" })).toBeInTheDocument();
    expect(within(dialog).getByText(pythonSkill.whereUsed!)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close Python experience" })).toBeInTheDocument();
  });
});
