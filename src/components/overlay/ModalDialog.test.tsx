import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalDialog, modalDialogFadeMs } from "@/components/overlay/ModalDialog";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
const nativeDialogPrototype = HTMLDialogElement.prototype;
const nativeShowModalDescriptor = Object.getOwnPropertyDescriptor(nativeDialogPrototype, "showModal");
const nativeCloseDescriptor = Object.getOwnPropertyDescriptor(nativeDialogPrototype, "close");

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

function FullscreenDialogHarness() {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      ariaLabel="Fullscreen dialog"
      dialogId="fullscreen-dialog"
      initialFocusRef={closeButtonRef}
      onRequestClose={() => undefined}
      open
    >
      <button ref={closeButtonRef} type="button">
        Close fullscreen dialog
      </button>
      <div
        data-testid="fullscreen-scope"
        onKeyDown={(event) => {
          if (event.key === "Escape") event.preventDefault();
        }}
        tabIndex={-1}
      >
        <button type="button">Fullscreen first</button>
        <button type="button">Fullscreen last</button>
      </div>
    </ModalDialog>
  );
}

function InPlaceDialogHarness({
  initiallyOpen = false,
  onOpenError
}: {
  initiallyOpen?: boolean;
  onOpenError?: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div data-testid="in-place-render-root">
      <button onClick={() => setOpen(true)} ref={triggerRef} type="button">
        Open in-place media
      </button>
      <ModalDialog
        ariaLabel="In-place media"
        dataTestId="in-place-dialog"
        dialogId="in-place-dialog"
        initialFocusRef={closeButtonRef}
        onOpenError={onOpenError}
        onRequestClose={() => setOpen(false)}
        open={open}
        presentation="in-place"
        restoreFocusRef={triggerRef}
      >
        <button type="button">Inline player control</button>
        <button onClick={() => setOpen(false)} ref={closeButtonRef} type="button">
          Close in-place media
        </button>
      </ModalDialog>
    </div>
  );
}

function NestedInPlaceDialogHarness() {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);
  const parentCloseRef = useRef<HTMLButtonElement>(null);
  const childCloseRef = useRef<HTMLButtonElement>(null);
  const childTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      ariaLabel="Portal parent"
      dialogId="portal-parent"
      initialFocusRef={parentCloseRef}
      onRequestClose={() => setParentOpen(false)}
      open={parentOpen}
    >
      <button onClick={() => setChildOpen(true)} ref={childTriggerRef} type="button">
        Open in-place child
      </button>
      <button onClick={() => setParentOpen(false)} ref={parentCloseRef} type="button">
        Close portal parent
      </button>
      <ModalDialog
        ariaLabel="In-place child"
        dialogId="in-place-child"
        initialFocusRef={childCloseRef}
        onRequestClose={() => setChildOpen(false)}
        open={childOpen}
        presentation="in-place"
        restoreFocusRef={childTriggerRef}
      >
        <button ref={childCloseRef} type="button">
          Close in-place child
        </button>
      </ModalDialog>
    </ModalDialog>
  );
}

describe("ModalDialog", () => {
  beforeEach(() => {
    motionPreference.reduced = false;
    document.body.style.overflow = "";
    Object.defineProperty(nativeDialogPrototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        if (this.open) throw new DOMException("The dialog is already open.", "InvalidStateError");
        this.setAttribute("open", "");
      }
    });
    Object.defineProperty(nativeDialogPrototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = "";
    if (nativeShowModalDescriptor) Object.defineProperty(nativeDialogPrototype, "showModal", nativeShowModalDescriptor);
    else Reflect.deleteProperty(nativeDialogPrototype, "showModal");
    if (nativeCloseDescriptor) Object.defineProperty(nativeDialogPrototype, "close", nativeCloseDescriptor);
    else Reflect.deleteProperty(nativeDialogPrototype, "close");
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
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.parentElement).not.toHaveAttribute("aria-hidden");
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

  it("keeps focus inside a fullscreen dialog descendant and lets that surface consume Escape", () => {
    vi.useFakeTimers();
    render(<FullscreenDialogHarness />);
    act(() => vi.runOnlyPendingTimers());

    const dialog = screen.getByRole("dialog", { name: "Fullscreen dialog" });
    const closeButton = within(dialog).getByRole("button", { name: "Close fullscreen dialog" });
    const fullscreenScope = screen.getByTestId("fullscreen-scope");
    const first = within(fullscreenScope).getByRole("button", { name: "Fullscreen first" });
    const last = within(fullscreenScope).getByRole("button", { name: "Fullscreen last" });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: fullscreenScope });

    closeButton.focus();
    fireEvent.focusIn(closeButton);
    expect(first).toHaveFocus();

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Fullscreen dialog" })).toBeInTheDocument();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  });

  it("keeps in-place media inline and semantically neutral until its native dialog opens", () => {
    vi.useFakeTimers();
    render(<InPlaceDialogHarness />);

    const nativeDialog = screen.getByTestId("in-place-dialog");
    const inlineControl = nativeDialog.querySelector<HTMLButtonElement>("button")!;

    expect(nativeDialog).toHaveAttribute("role", "presentation");
    expect(nativeDialog).not.toHaveAttribute("aria-label");
    expect(nativeDialog).not.toHaveAttribute("tabindex");
    expect(nativeDialog).not.toHaveAttribute("aria-hidden");
    expect(inlineControl).toHaveTextContent("Inline player control");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open in-place media" }));
    act(() => vi.runOnlyPendingTimers());

    const openDialog = screen.getByRole("dialog", { name: "In-place media" });
    const closeButton = within(openDialog).getByRole("button", { name: "Close in-place media" });

    expect(openDialog).toBe(nativeDialog);
    expect(within(openDialog).getByRole("button", { name: "Inline player control" })).toBe(inlineControl);
    expect(openDialog).toHaveAttribute("open");
    expect(closeButton).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(closeButton);
    act(() => vi.advanceTimersByTime(modalDialogFadeMs));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(nativeDialog.querySelector("button")).toBe(inlineControl);
    expect(nativeDialog).not.toHaveAttribute("open");
    expect(nativeDialog).toHaveAttribute("role", "presentation");
    expect(nativeDialog).not.toHaveAttribute("aria-label");
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByRole("button", { name: "Open in-place media" })).toHaveFocus();
  });

  it("uses native cancel for one shared close request and releases the top layer", () => {
    vi.useFakeTimers();
    render(<InPlaceDialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Open in-place media" }));
    act(() => vi.runOnlyPendingTimers());

    const nativeDialog = screen.getByRole("dialog", { name: "In-place media" });
    fireEvent(nativeDialog, new Event("cancel", { cancelable: true }));

    expect(nativeDialog).toHaveAttribute("data-state", "closing");
    act(() => vi.advanceTimersByTime(modalDialogFadeMs));

    expect(nativeDialog).not.toHaveAttribute("open");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cleans up a failed native showModal call and reports it to the owner", () => {
    vi.useFakeTimers();
    const onOpenError = vi.fn();
    Object.defineProperty(nativeDialogPrototype, "showModal", {
      configurable: true,
      value() {
        throw new DOMException("Native dialog unavailable.", "InvalidStateError");
      }
    });
    render(<InPlaceDialogHarness initiallyOpen onOpenError={onOpenError} />);
    act(() => vi.runOnlyPendingTimers());

    const nativeDialog = screen.getByTestId("in-place-dialog");
    expect(onOpenError).toHaveBeenCalledTimes(1);
    expect(nativeDialog).not.toHaveAttribute("open");
    expect(nativeDialog).toHaveAttribute("role", "presentation");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps a portal ancestor exposed while its nested native dialog is topmost", () => {
    vi.useFakeTimers();
    render(<NestedInPlaceDialogHarness />);
    act(() => vi.runOnlyPendingTimers());

    const parentDialog = screen.getByRole("dialog", { name: "Portal parent" });
    const parentRoot = parentDialog.parentElement as HTMLElement;
    const childTrigger = within(parentDialog).getByRole("button", { name: "Open in-place child" });
    fireEvent.click(childTrigger);
    act(() => vi.runOnlyPendingTimers());

    const childDialog = screen.getByRole("dialog", { name: "In-place child" });
    expect(parentRoot).toHaveAttribute("data-topmost", "false");
    expect(parentRoot).not.toHaveAttribute("aria-hidden");
    expect(within(childDialog).getByRole("button", { name: "Close in-place child" })).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.advanceTimersByTime(modalDialogFadeMs));

    expect(childTrigger).toHaveFocus();
    expect(parentRoot).toHaveAttribute("data-topmost", "true");
  });
});
