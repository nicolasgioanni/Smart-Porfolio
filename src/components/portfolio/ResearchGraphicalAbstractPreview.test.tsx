import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResearchGraphicalAbstractPreview } from "@/components/portfolio/ResearchGraphicalAbstractPreview";

const graphicalAbstract = {
  alt: "Four-step research workflow.",
  height: 900,
  source: "curated" as const,
  src: "/images/research/example.png",
  width: 1600
};

describe("ResearchGraphicalAbstractPreview", () => {
  it("opens a labelled dialog with descriptive media and restores trigger focus after the visible close control", async () => {
    const originalBodyOverflow = document.body.style.overflow;
    const { container } = render(
      <ResearchGraphicalAbstractPreview abstract={graphicalAbstract} title="Example Research" />
    );
    const trigger = screen.getByRole("button", { name: "Open graphical abstract for Example Research" });
    const thumbnail = container.querySelector(".research-abstract__thumbnail");

    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(thumbnail).toHaveAttribute("alt", "");
    expect(thumbnail).toHaveAttribute("width", "1600");
    expect(thumbnail).toHaveAttribute("height", "900");

    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Graphical abstract for Example Research" });
    const closeButton = within(dialog).getByRole("button", {
      name: "Close graphical abstract for Example Research"
    });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByRole("img", { name: graphicalAbstract.alt })).toHaveAttribute(
      "src",
      graphicalAbstract.src
    );
    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(closeButton).toHaveFocus();
    trigger.focus();
    await waitFor(() => expect(closeButton).toHaveFocus());

    fireEvent.click(closeButton);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe(originalBodyOverflow);
  });

  it("closes from Escape and the backdrop through the shared dialog contract", async () => {
    render(<ResearchGraphicalAbstractPreview abstract={graphicalAbstract} title="Example Research" />);
    const trigger = screen.getByRole("button", { name: "Open graphical abstract for Example Research" });

    fireEvent.click(trigger);
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(dialog.parentElement as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("keeps the consumer stable when it is reopened during the exit interval", async () => {
    render(<ResearchGraphicalAbstractPreview abstract={graphicalAbstract} title="Example Research" />);
    const trigger = screen.getByRole("button", { name: "Open graphical abstract for Example Research" });

    fireEvent.click(trigger);
    let dialog = await screen.findByRole("dialog");
    const closeButton = within(dialog).getByRole("button", {
      name: "Close graphical abstract for Example Research"
    });
    fireEvent.click(closeButton);
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: /Close graphical abstract/ })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
