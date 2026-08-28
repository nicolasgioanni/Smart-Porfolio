import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalDialog, modalDialogFadeMs } from "@/components/overlay/ModalDialog";

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock("@/components/motion/useReducedMotionPreference", () => ({
  useReducedMotionPreference: () => motionPreference.reduced
}));

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div data-testid="render-root">
      <button onClick={() => setOpen(true)} ref={triggerRef} type="button">
        Open preview
      </button>
      <ModalDialog
        ariaDescribedBy="preview-summary"
        ariaLabelledBy="preview-title"
        dialogId="preview-dialog"
        initialFocusRef={closeButtonRef}
        onRequestClose={() => setOpen(false)}
        open={open}
        restoreFocusRef={triggerRef}
        rootClassName="preview-dialog"
      >
        <h2 id="preview-title">Research preview</h2>
        <p id="preview-summary">A larger view of the selected research artifact.</p>
        <button onClick={() => setOpen(false)} ref={closeButtonRef} type="button">
          Close preview
        </button>
        <a href="/research">Research details</a>
      </ModalDialog>
    </div>
  );
}

function MediaDialogHarness() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button onClick={() => setOpen(true)} ref={triggerRef} type="button">
        Open media
      </button>
      <ModalDialog
        ariaLabel="CytoCV demonstration"
        dialogId="media-dialog"
        initialFocusRef={closeButtonRef}
        onRequestClose={() => setOpen(false)}
        open={open}
        restoreFocusRef={triggerRef}
      >
        <video aria-label="CytoCV video controls" controls tabIndex={0} />
        <button onClick={() => setOpen(false)} ref={closeButtonRef} type="button">
          Close media
        </button>
      </ModalDialog>
    </>
  );
}

function StackedDialogHarness() {
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const primaryCloseRef = useRef<HTMLButtonElement>(null);
  const primaryTriggerRef = useRef<HTMLButtonElement>(null);
  const secondaryCloseRef = useRef<HTMLButtonElement>(null);
  const secondaryTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button onClick={() => setPrimaryOpen(true)} ref={primaryTriggerRef} type="button">
        Open primary
      </button>
      <ModalDialog
        ariaLabel="Primary dialog"
        dialogId="primary-dialog"
        initialFocusRef={primaryCloseRef}
        onRequestClose={() => setPrimaryOpen(false)}
        open={primaryOpen}
        restoreFocusRef={primaryTriggerRef}
      >
        <button onClick={() => setSecondaryOpen(true)} ref={secondaryTriggerRef} type="button">
          Open secondary
        </button>
        <button onClick={() => setPrimaryOpen(false)} ref={primaryCloseRef} type="button">
          Close primary
        </button>
      </ModalDialog>
      <ModalDialog
        ariaLabel="Secondary dialog"
        dialogId="secondary-dialog"
        initialFocusRef={secondaryCloseRef}
        onRequestClose={() => setSecondaryOpen(false)}
        open={secondaryOpen}
        restoreFocusRef={secondaryTriggerRef}
      >
        <button onClick={() => setSecondaryOpen(false)} ref={secondaryCloseRef} type="button">
          Close secondary
        </button>
      </ModalDialog>
    </>
  );
}

function PersistentDialogHarness({ onRequestClose }: { onRequestClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      ariaLabel="Persistent dialog"
      dialogId="persistent-dialog"
      initialFocusRef={closeButtonRef}
      onRequestClose={onRequestClose}
      open
    >
      <button ref={closeButtonRef} type="button">
        Close persistent dialog
      </button>
    </ModalDialog>
  );
}

describe("ModalDialog", () => {
  beforeEach(() => {
    motionPreference.reduced = false;
    document.body.style.overflow = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = "";
  });

  it("portals a labelled modal, locks scrolling, and focuses the requested control", async () => {
    const { container } = render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open preview" });

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Research preview" });
    const closeButton = within(dialog).getByRole("button", { name: "Close preview" });

    expect(container).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("A larger view of the selected research artifact.");
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() => expect(closeButton).toHaveFocus());
    await waitFor(() => expect(dialog.parentElement).toHaveAttribute("data-state", "open"));
  });

  it("contains keyboard focus, closes with Escape, and restores prior overflow and trigger focus", () => {
    vi.useFakeTimers();
    document.body.style.overflow = "clip";
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "Open preview" });
    fireEvent.click(trigger);
    act(() => vi.runOnlyPendingTimers());

    const dialog = screen.getByRole("dialog", { name: "Research preview" });
    const closeButton = within(dialog).getByRole("button", { name: "Close preview" });
    const detailsLink = within(dialog).getByRole("link", { name: "Research details" });

    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(detailsLink).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog.parentElement).toHaveAttribute("data-state", "closing");
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(detailsLink).toHaveFocus();

    act(() => vi.advanceTimersByTime(modalDialogFadeMs));

    expect(screen.queryByRole("dialog", { name: "Research preview" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("ignores frame clicks and closes from the backdrop without a delay for reduced motion", () => {
    vi.useFakeTimers();
    motionPreference.reduced = true;
    render(<DialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Open preview" }));
    act(() => vi.runOnlyPendingTimers());

    const dialog = screen.getByRole("dialog", { name: "Research preview" });
    const backdrop = dialog.parentElement as HTMLElement;

    expect(backdrop).toHaveAttribute("data-reduced-motion", "true");
    fireEvent.click(dialog);
    expect(dialog).toBeInTheDocument();

    fireEvent.click(backdrop);
    expect(backdrop).toHaveAttribute("data-state", "closing");
    act(() => vi.advanceTimersByTime(0));

    expect(screen.queryByRole("dialog", { name: "Research preview" })).not.toBeInTheDocument();
  });

  it("cancels a stale close when reopened during the exit transition", () => {
    vi.useFakeTimers();
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "Open preview" });
    fireEvent.click(trigger);
    act(() => vi.runOnlyPendingTimers());

    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    act(() => vi.advanceTimersByTime(modalDialogFadeMs / 2));
    fireEvent.click(trigger);
    act(() => vi.runOnlyPendingTimers());

    const dialog = screen.getByRole("dialog", { name: "Research preview" });
    expect(dialog.parentElement).toHaveAttribute("data-state", "open");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("keeps native video controls in the keyboard focus loop", () => {
    vi.useFakeTimers();
    render(<MediaDialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Open media" }));
    act(() => vi.runOnlyPendingTimers());

    const dialog = screen.getByRole("dialog", { name: "CytoCV demonstration" });
    const video = within(dialog).getByLabelText("CytoCV video controls");
    const closeButton = within(dialog).getByRole("button", { name: "Close media" });

    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(video).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(closeButton).toHaveFocus();
  });

  it("exposes and operates only the topmost dialog while preserving nested scroll locks", () => {
    vi.useFakeTimers();
    document.body.style.overflow = "clip";
    render(<StackedDialogHarness />);

    const primaryTrigger = screen.getByRole("button", { name: "Open primary" });
    fireEvent.click(primaryTrigger);
    act(() => vi.runOnlyPendingTimers());

    const primaryDialog = screen.getByRole("dialog", { name: "Primary dialog" });
    const primaryRoot = primaryDialog.parentElement as HTMLElement;
    const secondaryTrigger = within(primaryDialog).getByRole("button", { name: "Open secondary" });
    fireEvent.click(secondaryTrigger);
    act(() => vi.runOnlyPendingTimers());

    const secondaryDialog = screen.getByRole("dialog", { name: "Secondary dialog" });
    const secondaryRoot = secondaryDialog.parentElement as HTMLElement;

    expect(primaryRoot).toHaveAttribute("aria-hidden", "true");
    expect(primaryRoot).toHaveAttribute("data-topmost", "false");
    expect(secondaryRoot).toHaveAttribute("data-topmost", "true");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(secondaryRoot).toHaveAttribute("data-state", "closing");
    expect(primaryRoot).toHaveAttribute("data-state", "open");
    act(() => vi.advanceTimersByTime(modalDialogFadeMs));

    expect(screen.queryByRole("dialog", { name: "Secondary dialog" })).not.toBeInTheDocument();
    expect(primaryRoot).not.toHaveAttribute("aria-hidden");
    expect(primaryRoot).toHaveAttribute("data-topmost", "true");
    expect(secondaryTrigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.advanceTimersByTime(modalDialogFadeMs));

    expect(screen.queryByRole("dialog", { name: "Primary dialog" })).not.toBeInTheDocument();
    expect(primaryTrigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("recovers focus when it moves outside the active dialog", () => {
    vi.useFakeTimers();
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "Open preview" });
    fireEvent.click(trigger);
    act(() => vi.runOnlyPendingTimers());

    const closeButton = within(screen.getByRole("dialog", { name: "Research preview" })).getByRole(
      "button",
      { name: "Close preview" }
    );
    trigger.focus();
    fireEvent.focusIn(trigger);

    expect(closeButton).toHaveFocus();
  });

  it("deduplicates repeated Escape requests within one open cycle", () => {
    vi.useFakeTimers();
    const onRequestClose = vi.fn();
    render(<PersistentDialogHarness onRequestClose={onRequestClose} />);
    act(() => vi.runOnlyPendingTimers());

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
