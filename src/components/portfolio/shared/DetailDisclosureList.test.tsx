import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { DetailDisclosureList } from "@/components/portfolio/shared/DetailDisclosureList";
import { useDetailDisclosure } from "@/components/portfolio/shared/useDetailDisclosure";

const sections = [
  {
    details: ["The expanded evidence remains available in the labelled region."],
    id: "evidence",
    lead: "A concise lead stays in the normal-flow summary row.",
    title: "Evidence",
    tools: ["TypeScript"]
  }
];

const sectionsWithStaticSummary = [
  ...sections,
  {
    details: [],
    id: "static-evidence",
    lead: "This authored summary has no supporting detail.",
    title: "Static evidence"
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

function ControlledListWithStaticSummary() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { openDetail, toggle, usesNaturalFlow } = useDetailDisclosure(rootRef);

  return (
    <div ref={rootRef}>
      <DetailDisclosureList
        idPrefix="test"
        itemId="item"
        mode="overview"
        onToggle={(sectionId) => toggle("item", sectionId)}
        openSectionId={openDetail?.itemId === "item" ? openDetail.sectionId : undefined}
        overlayEnabled={!usesNaturalFlow}
        sections={sectionsWithStaticSummary}
      />
    </div>
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

  it("dismisses an active disclosure after a separate static summary is clicked", async () => {
    render(<ControlledListWithStaticSummary />);
    const trigger = screen.getByRole("button", { name: /Evidence/i });

    fireEvent.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));

    fireEvent.click(screen.getByText("Static evidence"));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });
});
