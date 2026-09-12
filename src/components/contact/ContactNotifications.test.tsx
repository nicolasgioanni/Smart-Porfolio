import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactNotifications } from "./ContactNotifications";
import { useContactNotifications } from "./useContactNotifications";

function Harness() {
  const sequence = useRef(0);
  const { notifications, announcement, notify, dismiss } = useContactNotifications();
  return <main>
    <button onClick={() => notify(`Failure ${++sequence.current}`)}>Fail</button>
    <button onClick={() => notify("Repeated failure")}>Repeat</button>
    <button onClick={() => notify("Request accepted", "success")}>Succeed</button>
    <ContactNotifications notifications={notifications} announcement={announcement} onDismiss={dismiss}
      onRestoreFocus={() => screen.getByRole("button", { name: "Fail" }).focus()} />
  </main>;
}

function advance(ms: number) { act(() => { vi.advanceTimersByTime(ms); }); }
function stack() { return screen.getByRole("region", { name: "Contact notifications" }); }
function cards() { return document.querySelectorAll(".contact-notice"); }

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("contact notification stack", () => {
  it("uses a body portal, announces outcomes without stealing focus, and caps the stack at three", () => {
    const { container } = render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Fail" });
    act(() => trigger.focus());
    for (let index = 0; index < 4; index += 1) fireEvent.click(trigger);
    expect(cards()).toHaveLength(3);
    expect(container.querySelector(".contact-notice")).toBeNull();
    expect(stack()).toHaveAttribute("data-expanded", "false");
    expect(cards()[0]).toHaveTextContent("Failure 4");
    expect(cards()[2]).toHaveTextContent("Failure 2");
    expect(screen.getByRole("alert")).toHaveTextContent("Failure 4");
    expect(trigger).toHaveFocus();
    expect(within(stack()).getAllByRole("button", { name: /Dismiss notification/ })).toHaveLength(1);
  });

  it("expires each card after its own 30 seconds and animates dismissal", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Fail"));
    advance(10_000);
    fireEvent.click(screen.getByText("Succeed"));
    advance(19_999);
    expect(cards()).toHaveLength(2);
    advance(1);
    expect(document.querySelector('[data-exiting="true"]')).not.toBeNull();
    advance(200);
    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveAttribute("data-tone", "success");
    expect(screen.getByRole("status")).toHaveTextContent("Request accepted");
    advance(10_000);
    expect(cards()).toHaveLength(0);
  });

  it("refreshes duplicates without adding cards, including during dismissal", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Repeat"));
    advance(30_000);
    fireEvent.click(screen.getByText("Repeat"));
    advance(200);
    expect(cards()).toHaveLength(1);
    expect(document.querySelector('[data-exiting="true"]')).toBeNull();
    advance(29_800);
    advance(200);
    expect(cards()).toHaveLength(0);
  });

  it("expands for keyboard access, pauses remaining lifetimes, and restores focus on dismiss", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Fail"));
    fireEvent.click(screen.getByText("Succeed"));
    advance(20_000);
    act(() => within(stack()).getByRole("button", { name: /Dismiss notification/ }).focus());
    expect(stack()).toHaveAttribute("data-expanded", "true");
    expect(within(stack()).getAllByRole("button", { name: /Dismiss notification/ })).toHaveLength(2);
    advance(60_000);
    expect(cards()).toHaveLength(2);
    fireEvent.click(document.activeElement!);
    advance(200);
    expect(cards()).toHaveLength(1);
    expect(within(stack()).getByRole("button", { name: /Dismiss notification/ })).toHaveFocus();
    act(() => screen.getByText("Fail").focus());
    advance(9_999);
    expect(cards()).toHaveLength(1);
    advance(201);
    expect(cards()).toHaveLength(0);
  });

  it("supports touch expansion, outside collapse, and Escape without trapping focus", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Fail"));
    fireEvent.click(screen.getByText("Succeed"));
    fireEvent.click(screen.getByRole("button", { name: "Show all 2 notifications" }));
    expect(stack()).toHaveAttribute("data-expanded", "true");
    advance(60_000);
    expect(cards()).toHaveLength(2);
    fireEvent.pointerDown(screen.getByText("Fail"));
    expect(stack()).toHaveAttribute("data-expanded", "false");
    const toggle = screen.getByRole("button", { name: "Show all 2 notifications" });
    act(() => toggle.focus());
    expect(stack()).toHaveAttribute("data-expanded", "true");
    const olderClose = within(stack()).getAllByRole("button", { name: /Dismiss notification/ })[1];
    act(() => olderClose.focus());
    fireEvent.keyDown(olderClose, { key: "Escape" });
    expect(stack()).toHaveAttribute("data-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("restores focus when a fourth notification evicts the focused oldest card", () => {
    render(<Harness />);
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByText("Fail"));
    fireEvent.click(screen.getByRole("button", { name: "Show all 3 notifications" }));
    act(() => within(stack()).getAllByRole("button", { name: /Dismiss notification/ })[2].focus());
    fireEvent.click(screen.getByText("Fail"));
    expect(cards()).toHaveLength(3);
    expect(within(stack()).getAllByRole("button", { name: /Dismiss notification/ })[0]).toHaveFocus();
  });

  it("restores useful focus when dismissal removes the collapsed two-card toggle", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Fail"));
    fireEvent.click(screen.getByText("Succeed"));
    const frontClose = within(stack()).getByRole("button", { name: /Dismiss notification/ });
    act(() => frontClose.focus());
    fireEvent.keyDown(frontClose, { key: "Escape" });
    fireEvent.click(frontClose);
    advance(200);
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Fail" })).toHaveFocus();
  });

  it("cleans up timers on unmount and dismisses immediately with reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByText("Fail"));
    fireEvent.click(within(stack()).getByRole("button", { name: /Dismiss notification/ }));
    expect(cards()).toHaveLength(0);
    fireEvent.click(screen.getByText("Fail"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
