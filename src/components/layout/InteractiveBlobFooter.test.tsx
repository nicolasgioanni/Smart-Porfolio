import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveBlobFooter } from "@/components/layout/InteractiveBlobFooter";

const navigationMock = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname
}));

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  options?: IntersectionObserverInit;
  targets: Set<Element>;
};

const observerRecords: ObserverRecord[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  callback: IntersectionObserverCallback;
  disconnect = vi.fn();
  observe: ReturnType<typeof vi.fn>;
  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
  unobserve: ReturnType<typeof vi.fn>;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    const targets = new Set<Element>();

    this.callback = callback;
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? "0px";
    this.thresholds = Array.isArray(options?.threshold) ? options.threshold : [options?.threshold ?? 0];
    this.observe = vi.fn((target: Element) => targets.add(target));
    this.unobserve = vi.fn((target: Element) => targets.delete(target));

    observerRecords.push({
      callback,
      disconnect: this.disconnect,
      observe: this.observe,
      options,
      targets
    });
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
    { href: "mailto:ngioanni@uw.edu", label: "ngioanni@uw.edu" },
    { href: "/contact", label: "Contact Form" }
  ]
};

function setScrollY(scrollY: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
}

function setDocumentMetrics({ clientHeight, scrollHeight }: { clientHeight: number; scrollHeight: number }) {
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: scrollHeight });
}

function findObserver(selector: string): ObserverRecord {
  const record = [...observerRecords]
    .reverse()
    .find(({ targets }) => [...targets].some((target) => target.matches(selector)));

  if (!record) throw new Error(`Missing IntersectionObserver for ${selector}.`);
  return record;
}

function makeRect({ bottom, height, top }: { bottom: number; height: number; top: number }): DOMRectReadOnly {
  return {
    bottom,
    height,
    left: 0,
    right: 1_000,
    top,
    width: 1_000,
    x: 0,
    y: top,
    toJSON: () => ({})
  };
}

function setRunwayRect({ bottom, top }: { bottom: number; top: number }) {
  const sentinel = document.querySelector<HTMLElement>(".blob-footer__runway-sentinel");
  if (!sentinel) throw new Error("Missing runway sentinel.");

  const height = Math.max(bottom - top, 1);
  sentinel.getBoundingClientRect = vi.fn(() => makeRect({ bottom, height, top }));
}

function reportIntersection(
  selector: string,
  {
    bottom = 630,
    isIntersecting = true,
    ratio,
    top = 570
  }: { bottom?: number; isIntersecting?: boolean; ratio: number; top?: number }
) {
  const record = findObserver(selector);
  const target = [...record.targets].find((candidate) => candidate.matches(selector));
  if (!target) throw new Error(`Missing observed target for ${selector}.`);

  const height = Math.max(bottom - top, 1);
  const intersectionHeight = isIntersecting ? height * ratio : 0;

  if (target.matches(".blob-footer__runway-sentinel")) {
    setRunwayRect({ bottom, top });
  }

  act(() => {
    record.callback(
      [
        {
          boundingClientRect: makeRect({ bottom, height, top }),
          intersectionRatio: ratio,
          intersectionRect: makeRect({
            bottom: Math.min(bottom, window.innerHeight),
            height: intersectionHeight,
            top: Math.max(top, 0)
          }),
          isIntersecting,
          rootBounds: makeRect({ bottom: window.innerHeight, height: window.innerHeight, top: 0 }),
          target,
          time: 0
        }
      ],
      {} as IntersectionObserver
    );
  });
}

function scrollTo(scrollY: number) {
  setScrollY(scrollY);
  fireEvent.scroll(window);
}

function renderFooter() {
  const view = render(<InteractiveBlobFooter {...footerProps} />);
  setRunwayRect({ bottom: 696, top: 648 });
  reportIntersection(".blob-footer__island", { ratio: 1 });
  return view;
}

function enterRunwayDownward() {
  setRunwayRect({ bottom: 588, top: 540 });
  scrollTo(window.scrollY + 40);
  reportIntersection(".blob-footer__runway-sentinel", { bottom: 588, ratio: 1, top: 540 });
}

function retreatRunwayUpward() {
  setRunwayRect({ bottom: 658, top: 610 });
  scrollTo(window.scrollY - 40);
  reportIntersection(".blob-footer__runway-sentinel", {
    bottom: 658,
    isIntersecting: false,
    ratio: 0,
    top: 610
  });
}

function expectFooterState(container: HTMLElement, state: "compact" | "expanded") {
  const footer = container.querySelector(".blob-footer");
  const oppositeState = state === "compact" ? "expanded" : "compact";

  expect(footer).toHaveAttribute("data-footer-state", state);
  expect(footer).toHaveClass(`blob-footer--${state}`);
  expect(footer).not.toHaveClass(`blob-footer--${oppositeState}`);
}

describe("InteractiveBlobFooter", () => {
  beforeEach(() => {
    navigationMock.pathname = "/";
    observerRecords.length = 0;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
    setDocumentMetrics({ clientHeight: 600, scrollHeight: 4_000 });
    setScrollY(400);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("server-renders the compact accessible fallback with inert details", () => {
    const serverMarkup = renderToString(<InteractiveBlobFooter {...footerProps} />);
    expect(serverMarkup).toContain('data-footer-state="compact"');
    expect(serverMarkup).toContain('aria-expanded="false"');
    expect(serverMarkup).toContain('aria-hidden="true"');
    expect(serverMarkup).toContain('inert=""');
    expect(serverMarkup).toContain('class="blob-footer__runway"');
    expect(serverMarkup).toContain('class="blob-footer__runway-sentinel"');

    const { container } = renderFooter();
    const toggle = screen.getByRole("button", { name: "Details" });
    const details = container.querySelector<HTMLElement>(".blob-footer__details");

    expectFooterState(container, "compact");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", details?.id);
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(details).toHaveAttribute("inert");
    expect(screen.getByText(footerProps.compactCopyright)).toBeInTheDocument();
    expect(container.querySelector(".glass-icon-link")).not.toBeInTheDocument();
  });

  it("keeps the explicit Details fallback working without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<InteractiveBlobFooter {...footerProps} />);
    const details = container.querySelector<HTMLElement>(".blob-footer__details");

    expect(observerRecords).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expectFooterState(container, "expanded");
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true");
    expect(details).toHaveAttribute("aria-hidden", "false");
    expect(details).not.toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expectFooterState(container, "compact");
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(details).toHaveAttribute("inert");
  });

  it("keeps one hover-enabled disclosure control synchronized through a manual round trip", () => {
    const { container } = renderFooter();
    const details = container.querySelector<HTMLElement>(".blob-footer__details");
    const toggle = screen.getByRole("button", { name: "Details" });

    expect(toggle).toHaveClass("blob-footer__toggle", "hover-base-1", "hover-base-1--compact");
    expect(toggle).toHaveAttribute("aria-controls", details?.id);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(details).toHaveAttribute("inert");

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Collapse" })).toBe(toggle);
    expect(toggle).toHaveClass("blob-footer__toggle", "hover-base-1", "hover-base-1--compact");
    expect(toggle).toHaveAttribute("aria-controls", details?.id);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(details).toHaveAttribute("aria-hidden", "false");
    expect(details).not.toHaveAttribute("inert");
    expectFooterState(container, "expanded");

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Details" })).toBe(toggle);
    expect(toggle).toHaveClass("blob-footer__toggle", "hover-base-1", "hover-base-1--compact");
    expect(toggle).toHaveAttribute("aria-controls", details?.id);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(details).toHaveAttribute("inert");
    expectFooterState(container, "compact");
  });

  it("keeps the disclosure accessibility state synchronized through automatic expansion and collapse", () => {
    const { container } = renderFooter();
    const details = container.querySelector<HTMLElement>(".blob-footer__details");
    const toggle = screen.getByRole("button", { name: "Details" });
    toggle.focus();

    enterRunwayDownward();

    expect(screen.getByRole("button", { name: "Collapse" })).toBe(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(toggle);
    expect(details).toHaveAttribute("aria-hidden", "false");
    expect(details).not.toHaveAttribute("inert");
    expectFooterState(container, "expanded");

    retreatRunwayUpward();

    expect(screen.getByRole("button", { name: "Details" })).toBe(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(toggle);
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(details).toHaveAttribute("inert");
    expectFooterState(container, "compact");
  });

  it("renders the complete labelled footer content and preserves link order when expanded", () => {
    renderFooter();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    const notices = screen.getByRole("navigation", { name: "Notices" });
    const resources = screen.getByRole("navigation", { name: "Resources" });

    expect(screen.getByRole("heading", { name: footerProps.owner })).toBeInTheDocument();
    expect(screen.getByText(footerProps.identityDescription)).toBeInTheDocument();
    expect(screen.getByText(footerProps.closingStatement)).toBeInTheDocument();
    expect(within(notices).getAllByRole("link").map((link) => link.textContent)).toEqual(
      footerProps.noticeLinks.map((link) => link.label)
    );
    expect(within(resources).getAllByRole("link").map((link) => link.textContent)).toEqual(
      footerProps.resourceLinks.map((link) => link.label)
    );
  });

  it("observes a stable runway sentinel and the visual island", () => {
    const { container } = renderFooter();
    const runway = container.querySelector(".blob-footer__runway");
    const sentinel = container.querySelector(".blob-footer__runway-sentinel");
    const sentinelObserver = findObserver(".blob-footer__runway-sentinel");
    const island = container.querySelector(".blob-footer__island");

    expect(runway).toHaveAttribute("aria-hidden", "true");
    expect(sentinel).toBeInTheDocument();
    expect(sentinelObserver.observe).toHaveBeenCalledWith(sentinel);
    expect(sentinelObserver.options?.threshold).toEqual([0, 1]);
    expect(findObserver(".blob-footer__island").observe).toHaveBeenCalledWith(island);
    expect(findObserver(".blob-footer__island").options?.threshold ?? 0).toBe(0);
  });

  it("keeps the compact dock visible before the runway sentinel is reached", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__runway-sentinel", {
      bottom: 696,
      isIntersecting: false,
      ratio: 0,
      top: 648
    });

    expectFooterState(container, "compact");
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
  });

  it("expands on downward scroll when the activation band was already fully visible", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__runway-sentinel", { bottom: 588, ratio: 1, top: 540 });
    expectFooterState(container, "compact");

    setRunwayRect({ bottom: 588, top: 540 });
    scrollTo(440);
    expectFooterState(container, "expanded");
  });

  it("stays compact on downward scroll while the activation band is only partially visible", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__runway-sentinel", { bottom: 624, ratio: 0.5, top: 576 });
    setRunwayRect({ bottom: 624, top: 576 });
    scrollTo(440);

    expectFooterState(container, "compact");
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
  });

  it("expands when collapsing page content moves the full runway sentinel into view without scrolling", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__runway-sentinel", {
      bottom: 696,
      isIntersecting: false,
      ratio: 0,
      top: 648
    });
    expect(window.scrollY).toBe(400);
    expectFooterState(container, "compact");

    reportIntersection(".blob-footer__runway-sentinel", { bottom: 588, ratio: 1, top: 540 });

    expect(window.scrollY).toBe(400);
    expectFooterState(container, "expanded");
  });

  it("expands after a content collapse moves the sentinel upward while the browser clamps scrollY upward", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__runway-sentinel", {
      bottom: 696,
      isIntersecting: false,
      ratio: 0,
      top: 648
    });

    scrollTo(320);
    reportIntersection(".blob-footer__runway-sentinel", { bottom: 624, ratio: 0.5, top: 576 });
    expectFooterState(container, "compact");

    reportIntersection(".blob-footer__runway-sentinel", { bottom: 588, ratio: 1, top: 540 });

    expect(window.scrollY).toBe(320);
    expectFooterState(container, "expanded");
  });

  it("does not treat ordinary upward scrolling as an upward layout shift", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__runway-sentinel", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -58
    });

    scrollTo(100);
    reportIntersection(".blob-footer__runway-sentinel", { bottom: 290, ratio: 1, top: 242 });

    expectFooterState(container, "compact");
  });

  it("expands inside the reserved runway without requiring the hard document bottom", () => {
    const { container } = renderFooter();

    expect(window.scrollY + window.innerHeight).toBeLessThan(document.documentElement.scrollHeight);
    enterRunwayDownward();

    expectFooterState(container, "expanded");
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(".blob-footer__details")).not.toHaveAttribute("inert");
    expect(window.scrollY + window.innerHeight).toBeLessThan(document.documentElement.scrollHeight);
  });

  it("keeps the same sentinel target while expanded geometry changes", () => {
    const { container } = renderFooter();
    const sentinel = container.querySelector(".blob-footer__runway-sentinel");

    enterRunwayDownward();
    reportIntersection(".blob-footer__runway-sentinel", { bottom: 570, ratio: 0.5, top: 522 });
    reportIntersection(".blob-footer__runway-sentinel", { bottom: -10, isIntersecting: false, ratio: 0, top: -58 });

    expectFooterState(container, "expanded");
    expect(findObserver(".blob-footer__runway-sentinel").targets).toContain(sentinel);
  });

  it("stays expanded when the sentinel exits above the viewport in either scroll direction", () => {
    const { container } = renderFooter();
    enterRunwayDownward();

    scrollTo(520);
    reportIntersection(".blob-footer__runway-sentinel", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -58
    });
    expectFooterState(container, "expanded");

    scrollTo(500);
    reportIntersection(".blob-footer__runway-sentinel", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -58
    });
    expectFooterState(container, "expanded");
  });

  it("collapses only after upward scrolling carries the full sentinel below the viewport", () => {
    const { container } = renderFooter();
    enterRunwayDownward();

    setRunwayRect({ bottom: 600, top: 552 });
    scrollTo(420);
    reportIntersection(".blob-footer__runway-sentinel", { bottom: 600, ratio: 0.01, top: 552 });
    expectFooterState(container, "expanded");

    setRunwayRect({ bottom: 648, top: 600 });
    scrollTo(400);
    reportIntersection(".blob-footer__runway-sentinel", {
      bottom: 648,
      isIntersecting: false,
      ratio: 0,
      top: 600
    });
    expectFooterState(container, "compact");
  });

  it("collapses expanded details when the visual footer island leaves the viewport", () => {
    const { container } = renderFooter();
    const details = container.querySelector<HTMLElement>(".blob-footer__details");
    enterRunwayDownward();

    reportIntersection(".blob-footer__island", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -100
    });

    expectFooterState(container, "compact");
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
    expect(details).toHaveAttribute("aria-hidden", "true");
    expect(details).toHaveAttribute("inert");
  });

  it("keeps manual Collapse suppressed until the visual island exits and later re-enters", () => {
    const { container } = renderFooter();
    enterRunwayDownward();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expectFooterState(container, "compact");

    setRunwayRect({ bottom: 588, top: 540 });
    scrollTo(window.scrollY + 40);
    expectFooterState(container, "compact");

    reportIntersection(".blob-footer__island", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -100
    });
    reportIntersection(".blob-footer__island", { ratio: 1 });
    setRunwayRect({ bottom: 588, top: 540 });
    scrollTo(window.scrollY + 40);
    expectFooterState(container, "expanded");
  });

  it("lets Details override and clear manual suppression", () => {
    const { container } = renderFooter();
    enterRunwayDownward();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expectFooterState(container, "expanded");

    retreatRunwayUpward();
    expectFooterState(container, "compact");

    enterRunwayDownward();
    expectFooterState(container, "expanded");
  });

  it("preserves link access and moves focus safely before manual collapse", () => {
    const { container } = renderFooter();
    const toggle = screen.getByRole("button", { name: "Details" });

    fireEvent.click(toggle);
    const details = container.querySelector<HTMLElement>(".blob-footer__details");
    expect(details).toHaveAttribute("aria-hidden", "false");
    expect(within(details!).getByRole("link", { name: "Site Terms & Accuracy" })).toHaveAttribute("href", "/terms");
    expect(within(details!).getByRole("link", { name: "MIT License" })).toHaveAttribute(
      "href",
      "https://github.com/nicolasgioanni/Portfolio-New/blob/main/LICENSE"
    );

    const termsLink = within(details!).getByRole("link", { name: "Site Terms & Accuracy" });
    termsLink.focus();
    fireEvent.click(toggle);

    expect(document.activeElement).toBe(toggle);
    expectFooterState(container, "compact");
  });

  it("defers automatic collapse while details contain focus, then collapses after focus leaves", () => {
    const { container } = renderFooter();
    enterRunwayDownward();

    const termsLink = screen.getByRole("link", { name: "Site Terms & Accuracy" });
    const privacyLink = screen.getByRole("link", { name: "Privacy Notice" });
    termsLink.focus();
    retreatRunwayUpward();
    expectFooterState(container, "expanded");

    fireEvent.blur(termsLink, { relatedTarget: privacyLink });
    privacyLink.focus();
    expectFooterState(container, "expanded");

    reportIntersection(".blob-footer__runway-sentinel", { bottom: 588, ratio: 1, top: 540 });
    expectFooterState(container, "expanded");

    act(() => {
      screen.getByRole("button", { name: "Collapse" }).focus();
    });
    expectFooterState(container, "compact");
  });

  it("expands on the next downward scroll after a route reset when the sentinel is already fully visible", () => {
    const view = renderFooter();
    enterRunwayDownward();
    expectFooterState(view.container, "expanded");

    setScrollY(0);
    navigationMock.pathname = "/privacy";
    view.rerender(<InteractiveBlobFooter {...footerProps} />);
    expectFooterState(view.container, "compact");

    reportIntersection(".blob-footer__runway-sentinel", { bottom: 588, ratio: 1, top: 540 });
    expectFooterState(view.container, "compact");

    setRunwayRect({ bottom: 588, top: 540 });
    scrollTo(40);
    expectFooterState(view.container, "expanded");
  });

  it("clears manual-collapse suppression when the route changes", () => {
    const view = renderFooter();
    enterRunwayDownward();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    setRunwayRect({ bottom: 588, top: 540 });
    scrollTo(window.scrollY + 40);
    expectFooterState(view.container, "compact");

    navigationMock.pathname = "/privacy";
    view.rerender(<InteractiveBlobFooter {...footerProps} />);
    setRunwayRect({ bottom: 588, top: 540 });
    scrollTo(window.scrollY + 40);

    expectFooterState(view.container, "expanded");
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true");
  });

  it("defers a route-change reset until focus leaves the details", () => {
    const view = renderFooter();
    enterRunwayDownward();
    screen.getByRole("link", { name: "Site Terms & Accuracy" }).focus();

    navigationMock.pathname = "/security";
    view.rerender(<InteractiveBlobFooter {...footerProps} />);
    expectFooterState(view.container, "expanded");

    act(() => {
      screen.getByRole("button", { name: "Collapse" }).focus();
    });
    expectFooterState(view.container, "compact");
  });

  it("disconnects observers and removes only its passive native scroll listener", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const view = renderFooter();

    expect(addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
    expect(addEventListener).not.toHaveBeenCalledWith("wheel", expect.any(Function), expect.anything());
    expect(addEventListener).not.toHaveBeenCalledWith("touchmove", expect.any(Function), expect.anything());
    const scrollListener = addEventListener.mock.calls.find(([type]) => type === "scroll")?.[1];
    expect(scrollListener).toBeTypeOf("function");

    view.unmount();

    expect(observerRecords.length).toBeGreaterThanOrEqual(1);
    for (const record of observerRecords) expect(record.disconnect).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith("scroll", scrollListener);
  });
});
