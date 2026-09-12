import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailDisclosureList } from "@/components/portfolio/shared/DetailDisclosureList";

const sections = [
  {
    details: ["The expanded evidence remains available in the labelled region."],
    id: "evidence",
    lead: "A concise lead stays in the normal-flow summary row.",
    title: "Evidence",
    tools: ["TypeScript"]
  }
];

function renderList(openSectionId?: string) {
  return render(
    <DetailDisclosureList
      idPrefix="test"
      itemId="item"
      mode="overview"
      onToggle={vi.fn()}
      openSectionId={openSectionId}
      overlayEnabled
      sections={sections}
    />
  );
}

describe("DetailDisclosureList", () => {
  it("keeps controlled accessibility state ahead of the local close lifecycle", () => {
    const { rerender } = renderList("evidence");
    const trigger = screen.getByRole("button", { name: /Evidence/i });
    const panel = screen.getByRole("region", { name: "Evidence" });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(panel).not.toHaveAttribute("inert");
    expect(panel.querySelector(".detail-section__panel-clip")).toHaveAttribute("tabindex", "0");

    rerender(
      <DetailDisclosureList
        idPrefix="test"
        itemId="item"
        mode="overview"
        onToggle={vi.fn()}
        overlayEnabled
        sections={sections}
      />
    );

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");
    expect(panel.querySelector(".detail-section__panel-clip")).toHaveAttribute("tabindex", "-1");
    expect(panel.closest(".detail-section")).toHaveAttribute("data-visual-state", "closing");
  });

  it("does not let a stale close completion clear a reopened panel", () => {
    const { rerender } = renderList("evidence");
    const trigger = screen.getByRole("button", { name: /Evidence/i });
    const panel = screen.getByRole("region", { name: "Evidence" });

    rerender(
      <DetailDisclosureList
        idPrefix="test"
        itemId="item"
        mode="overview"
        onToggle={vi.fn()}
        overlayEnabled
        sections={sections}
      />
    );
    expect(panel.closest(".detail-section")).toHaveAttribute("data-visual-state", "closing");

    rerender(
      <DetailDisclosureList
        idPrefix="test"
        itemId="item"
        mode="overview"
        onToggle={vi.fn()}
        openSectionId="evidence"
        overlayEnabled
        sections={sections}
      />
    );
    fireEvent.transitionEnd(panel, { propertyName: "grid-template-rows" });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(panel.closest(".detail-section")).toHaveAttribute("data-visual-state", "open");
  });
});
