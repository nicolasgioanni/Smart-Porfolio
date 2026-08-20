import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOOTER_SCROLL_INTENT_THRESHOLD,
  InteractiveBlobFooter,
  isAtDocumentBottom,
  isFooterControlTarget,
  normalizeWheelDelta
} from "@/components/layout/InteractiveBlobFooter";

const navigationMock = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname
}));

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
};

const observerRecords: ObserverRecord[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  callback: IntersectionObserverCallback;
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
  unobserve = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    observerRecords.push({ callback, disconnect: this.disconnect, observe: this.observe });
  }
}

const footerProps = {
  closingStatement:
    "Original portfolio content and media are protected. Site source code is licensed under the MIT License. Third-party names, marks, and materials remain the property of their respective owners.",
  compactCopyright: "© 2026 Nicolas Gioanni. All rights reserved except where otherwise stated.",
  identityDescription: "Software engineering, research, and cybersecurity portfolio.",
  noticeLinks: [
    { href: "/terms", label: "Site Terms & Accuracy" },
    { href: "/privacy", label: "Privacy Notice" },
    { href: "/security", label: "Security & Responsible Disclosure" }
  ],
  owner: "Nicolas Gioanni",
  resourceLinks: [
    { href: "https://github.com/nicolasgioanni/Portfolio-New", label: "Source Code" },
    { href: "https://github.com/nicolasgioanni/Portfolio-New/blob/main/LICENSE", label: "MIT License" },
    { href: "mailto:ngioanni@uw.edu", label: "ngioanni@uw.edu" }
  ]
};

function setViewport({ height = 600, scrollHeight = 1_000, scrollY = 400 } = {}) {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(document.documentElement, "offsetHeight", { configurable: true, value: scrollHeight });
}

function reportFooterVisibility(isIntersecting: boolean) {
  const record = observerRecords.at(-1);
  if (!record) throw new Error("Missing footer IntersectionObserver record.");

  act(() => {
    record.callback(
      [
        {
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          target: record.observe.mock.calls[0]?.[0]
        } as IntersectionObserverEntry
      ],
      {} as IntersectionObserver
    );
  });
}

function renderFooter() {
  const view = render(<InteractiveBlobFooter {...footerProps} />);
  reportFooterVisibility(true);
  return view;
}

describe("InteractiveBlobFooter", () => {
  beforeEach(() => {
    navigationMock.pathname = "/";
    observerRecords.length = 0;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    setViewport();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("server-renders the compact, accessible fallback with inert details", () => {
    const serverMarkup = renderToString(<InteractiveBlobFooter {...footerProps} />);
    expect(serverMarkup).toContain('data-footer-state="compact"');
    expect(serverMarkup).toContain('aria-expanded="false"');
    expect(serverMarkup).toContain('aria-hidden="true"');
    expect(serverMarkup).toContain('inert=""');

    const { container } = renderFooter();
    const footer = container.querySelector(".blob-footer");
    const toggle = screen.getByRole("button", { name: "Details" });
    const details = container.querySelector<HTMLElement>(".blob-footer__details");

    expect(footer).toHaveAttribute("data-footer-state", "compact");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", details?.id);
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(details).toHaveAttribute("inert");
    expect(screen.getByText(footerProps.compactCopyright)).toBeInTheDocument();
    expect(container.querySelector(".glass-icon-link")).not.toBeInTheDocument();
  });

  it("expands after 140 normalized wheel pixels only at the true bottom", () => {
    const { container } = renderFooter();
    const footer = container.querySelector(".blob-footer");

    setViewport({ scrollY: 300 });
    fireEvent.wheel(window, { deltaMode: WheelEvent.DOM_DELTA_PIXEL, deltaY: 100 });
    expect(footer).toHaveAttribute("data-footer-state", "compact");

    setViewport();
    fireEvent.wheel(window, { deltaMode: WheelEvent.DOM_DELTA_PIXEL, deltaY: 100 });
    setViewport({ scrollY: 300 });
    fireEvent.scroll(window);
    setViewport();
    fireEvent.wheel(window, { deltaMode: WheelEvent.DOM_DELTA_PIXEL, deltaY: 100 });
    fireEvent.wheel(window, { deltaMode: WheelEvent.DOM_DELTA_PIXEL, deltaY: -1 });
    fireEvent.wheel(window, { deltaMode: WheelEvent.DOM_DELTA_LINE, deltaY: 6 });
    expect(footer).toHaveAttribute("data-footer-state", "compact");

    const finalEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: 44
    });
    act(() => {
      window.dispatchEvent(finalEvent);
    });

    expect(finalEvent.defaultPrevented).toBe(false);
    expect(footer).toHaveAttribute("data-footer-state", "expanded");
    expect(document.activeElement).toBe(document.body);
  });

  it("supports single-touch upward swipes and ignores multi-touch gestures", () => {
    const { container } = renderFooter();
    const footer = container.querySelector(".blob-footer");

    fireEvent.touchStart(window, { touches: [{ clientY: 400 }, { clientY: 420 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 200 }] });
    expect(footer).toHaveAttribute("data-footer-state", "compact");

    fireEvent.touchStart(window, { touches: [{ clientY: 400 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 320 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 260 }] });

    expect(footer).toHaveAttribute("data-footer-state", "expanded");
  });

  it("supports unmodified scroll keys outside controls", () => {
    const { container } = renderFooter();
    const footer = container.querySelector(".blob-footer");
    const toggle = screen.getByRole("button", { name: "Details" });

    fireEvent.keyDown(toggle, { key: "End" });
    fireEvent.keyDown(document.body, { ctrlKey: true, key: "End" });
    expect(footer).toHaveAttribute("data-footer-state", "compact");

    fireEvent.keyDown(document.body, { key: "PageDown" });
    fireEvent.keyDown(document.body, { key: "ArrowDown" });

    expect(footer).toHaveAttribute("data-footer-state", "expanded");
  });

  it.each([
    ["ArrowDown", 4],
    ["PageDown", 2],
    [" ", 2],
    ["End", 1]
  ] as const)("expands for the unmodified %s key at the bottom", (key, presses) => {
    const { container } = renderFooter();

    for (let index = 0; index < presses; index += 1) {
      fireEvent.keyDown(document.body, { key });
    }

    expect(container.querySelector(".blob-footer")).toHaveAttribute("data-footer-state", "expanded");
  });

  it("provides an explicit toggle and returns focus safely before manual collapse", () => {
    const { container } = renderFooter();
    const toggle = screen.getByRole("button", { name: "Details" });

    fireEvent.click(toggle);
    expect(toggle).toHaveAccessibleName("Collapse");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const details = container.querySelector<HTMLElement>(".blob-footer__details");
    expect(details).toHaveAttribute("aria-hidden", "false");
    expect(details).not.toHaveAttribute("inert");
    expect(within(details!).getByRole("link", { name: "Site Terms & Accuracy" })).toHaveAttribute("href", "/terms");
    expect(within(details!).getByRole("link", { name: "MIT License" })).toHaveAttribute(
      "href",
      "https://github.com/nicolasgioanni/Portfolio-New/blob/main/LICENSE"
    );

    const termsLink = within(details!).getByRole("link", { name: "Site Terms & Accuracy" });
    termsLink.focus();
    fireEvent.click(toggle);

    expect(document.activeElement).toBe(toggle);
    expect(toggle).toHaveAccessibleName("Details");
    expect(container.querySelector(".blob-footer")).toHaveAttribute("data-footer-state", "compact");
  });

  it("collapses offscreen or on route changes without collapsing focused details", () => {
    const view = renderFooter();
    const footer = view.container.querySelector(".blob-footer");
    const toggle = screen.getByRole("button", { name: "Details" });

    fireEvent.click(toggle);
    reportFooterVisibility(false);
    expect(footer).toHaveAttribute("data-footer-state", "compact");

    reportFooterVisibility(true);
    fireEvent.click(toggle);
    const termsLink = screen.getByRole("link", { name: "Site Terms & Accuracy" });
    termsLink.focus();
    reportFooterVisibility(false);
    expect(footer).toHaveAttribute("data-footer-state", "expanded");

    navigationMock.pathname = "/privacy";
    view.rerender(<InteractiveBlobFooter {...footerProps} />);
    expect(footer).toHaveAttribute("data-footer-state", "expanded");

    act(() => {
      toggle.focus();
    });
    expect(footer).toHaveAttribute("data-footer-state", "compact");
  });

  it("normalizes wheel modes and identifies true-bottom and control targets", () => {
    expect(normalizeWheelDelta(2, WheelEvent.DOM_DELTA_PIXEL, 800)).toBe(2);
    expect(normalizeWheelDelta(2, WheelEvent.DOM_DELTA_LINE, 800)).toBe(32);
    expect(normalizeWheelDelta(2, WheelEvent.DOM_DELTA_PAGE, 800)).toBe(1_600);
    expect(FOOTER_SCROLL_INTENT_THRESHOLD).toBe(140);
    expect(isAtDocumentBottom()).toBe(true);

    setViewport({ scrollY: 397 });
    expect(isAtDocumentBottom()).toBe(false);
    expect(isFooterControlTarget(document.createElement("input"))).toBe(true);
    expect(isFooterControlTarget(document.createElement("div"))).toBe(false);
  });
});
