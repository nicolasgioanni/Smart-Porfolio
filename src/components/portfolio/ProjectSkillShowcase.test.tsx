import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProjectSkillShowcase,
  projectSkillDialogFadeMs
} from "@/components/portfolio/ProjectSkillShowcase";

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock("@/components/motion/useReducedMotionPreference", () => ({
  useReducedMotionPreference: () => motionPreference.reduced
}));

const completeSkill = {
  name: "Next.js",
  icon: "nextdotjs",
  summary: "The application framework that powers the product interface.",
  details: "It provides server rendering, route composition, and the API boundary used by the project."
};

const legacySkill = {
  name: "TypeScript",
  icon: "typescript"
};

describe("ProjectSkillShowcase", () => {
  beforeEach(() => {
    motionPreference.reduced = false;
    document.body.style.overflow = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = "";
  });

  it("renders complete skill copy as a dialog trigger and legacy copy as a static badge", () => {
    render(
      <ProjectSkillShowcase
        projectTitle="NotePal"
        skills={[completeSkill, legacySkill]}
      />
    );

    const list = screen.getByRole("list", { name: "NotePal technical skills" });
    const trigger = within(list).getByRole("button", { name: /learn about next\.js/i });

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveClass(
      "project-skill-showcase__trigger",
      "skill-badge",
      "hover-base-1",
      "hover-base-1--compact"
    );
    expect(within(list).queryByRole("button", { name: /typescript/i })).not.toBeInTheDocument();
    expect(within(list).getByText("TypeScript").closest(".project-skill-showcase__badge")).toBeInTheDocument();
  });

  it("portals a labelled dialog, focuses its close control, and locks page scrolling", async () => {
    const { container } = render(
      <ProjectSkillShowcase projectTitle="NotePal" skills={[completeSkill]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /learn about next\.js/i }));

    const dialog = screen.getByRole("dialog", { name: "Next.js" });

    expect(container).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("Used in NotePal")).toHaveClass("project-skill-dialog__context");
    expect(within(dialog).getByText(completeSkill.summary)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Technical details" })).toBeInTheDocument();
    expect(within(dialog).getByText(completeSkill.details)).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    const closeButton = within(dialog).getByRole("button", { name: /close next\.js details/i });
    await waitFor(() => expect(closeButton).toHaveFocus());
    await waitFor(() => expect(dialog.parentElement).toHaveAttribute("data-state", "open"));
  });

  it("contains Tab focus, closes on Escape, restores focus, and restores body overflow", () => {
    vi.useFakeTimers();
    document.body.style.overflow = "clip";

    render(<ProjectSkillShowcase projectTitle="NotePal" skills={[completeSkill]} />);

    const trigger = screen.getByRole("button", { name: /learn about next\.js/i });
    fireEvent.click(trigger);
    act(() => vi.runOnlyPendingTimers());

    const dialog = screen.getByRole("dialog", { name: "Next.js" });
    const closeButton = within(dialog).getByRole("button", { name: /close next\.js details/i });

    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: "Escape" });
    expect(dialog.parentElement).toHaveAttribute("data-state", "closing");

    act(() => vi.advanceTimersByTime(projectSkillDialogFadeMs));

    expect(screen.queryByRole("dialog", { name: "Next.js" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("closes from the backdrop and skips the closing delay for reduced motion", () => {
    vi.useFakeTimers();
    motionPreference.reduced = true;

    render(<ProjectSkillShowcase projectTitle="NotePal" skills={[completeSkill]} />);

    const trigger = screen.getByRole("button", { name: /learn about next\.js/i });
    fireEvent.click(trigger);
    act(() => vi.runOnlyPendingTimers());

    const dialog = screen.getByRole("dialog", { name: "Next.js" });
    const backdrop = dialog.parentElement;

    expect(backdrop).toHaveAttribute("data-reduced-motion", "true");
    fireEvent.click(backdrop as HTMLElement);
    expect(backdrop).toHaveAttribute("data-state", "closing");

    act(() => vi.advanceTimersByTime(0));

    expect(screen.queryByRole("dialog", { name: "Next.js" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
