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
    { href: "mailto:ngioanni@uw.edu", label: "ngioanni@uw.edu" }
  ]
};

function setScrollY(scrollY: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
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
  reportIntersection(".blob-footer", { ratio: 1 });
  return view;
}

function expectFooterState(container: HTMLElement, state: "compact" | "expanded") {
  expect(container.querySelector(".blob-footer")).toHaveAttribute("data-footer-state", state);
}

describe("InteractiveBlobFooter", () => {
  beforeEach(() => {
    navigationMock.pathname = "/";
    observerRecords.length = 0;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
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

  it("observes a stable viewport trigger with the opening and closing thresholds", () => {
    const { container } = renderFooter();
    const trigger = container.querySelector(".blob-footer__viewport-trigger");
    const triggerObserver = findObserver(".blob-footer__viewport-trigger");

    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-hidden", "true");
    expect(triggerObserver.observe).toHaveBeenCalledWith(trigger);
    expect(triggerObserver.options?.threshold).toEqual([0, 0.15, 0.5, 1]);
    expect(findObserver(".blob-footer").options?.threshold ?? 0).toBe(0);
  });

  it("stays compact while the stable trigger remains below 50% visible", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.49 });
    expectFooterState(container, "compact");
  });

  it("expands at 50% when the trigger's initial observer report says it is already visible", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
    expectFooterState(container, "expanded");
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(".blob-footer__details")).not.toHaveAttribute("inert");
  });

  it("does not oscillate when expanded geometry causes repeated observer reports", () => {
    const { container } = renderFooter();

    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
    reportIntersection(".blob-footer__viewport-trigger", { bottom: 620, ratio: 0.15, top: 560 });
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });

    expectFooterState(container, "expanded");
    expect(findObserver(".blob-footer__viewport-trigger").targets).toContain(
      container.querySelector(".blob-footer__viewport-trigger")
    );
  });

  it("stays expanded while scrolling down and when the trigger exits above the viewport", () => {
    const { container } = renderFooter();
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });

    scrollTo(520);
    reportIntersection(".blob-footer__viewport-trigger", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -70
    });
    expectFooterState(container, "expanded");

    scrollTo(500);
    reportIntersection(".blob-footer__viewport-trigger", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -70
    });
    expectFooterState(container, "expanded");
  });

  it("collapses only on upward retreat through the lower viewport edge at 15% or less", () => {
    const { container } = renderFooter();
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });

    scrollTo(520);
    reportIntersection(".blob-footer__viewport-trigger", { bottom: 651, ratio: 0.15, top: 591 });
    expectFooterState(container, "expanded");

    scrollTo(480);
    reportIntersection(".blob-footer__viewport-trigger", { bottom: 650, ratio: 0.16, top: 590 });
    expectFooterState(container, "expanded");

    reportIntersection(".blob-footer__viewport-trigger", { bottom: 651, ratio: 0.15, top: 591 });
    expectFooterState(container, "compact");
  });

  it("keeps a manual Collapse suppressed until the full footer exits and later re-enters", () => {
    const { container } = renderFooter();
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expectFooterState(container, "compact");

    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.75 });
    expectFooterState(container, "compact");

    reportIntersection(".blob-footer__viewport-trigger", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -70
    });
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
    expectFooterState(container, "compact");

    reportIntersection(".blob-footer", {
      bottom: -10,
      isIntersecting: false,
      ratio: 0,
      top: -100
    });
    reportIntersection(".blob-footer", { ratio: 1 });
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
    expectFooterState(container, "expanded");
  });

  it("lets Details override and clear manual suppression", () => {
    const { container } = renderFooter();
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expectFooterState(container, "expanded");

    scrollTo(360);
    reportIntersection(".blob-footer__viewport-trigger", { bottom: 651, ratio: 0.15, top: 591 });
    expectFooterState(container, "compact");

    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
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
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });

    const termsLink = screen.getByRole("link", { name: "Site Terms & Accuracy" });
    termsLink.focus();
    scrollTo(360);
    reportIntersection(".blob-footer__viewport-trigger", { bottom: 651, ratio: 0.15, top: 591 });
    expectFooterState(container, "expanded");

    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
    expectFooterState(container, "expanded");

    act(() => {
      screen.getByRole("button", { name: "Collapse" }).focus();
    });
    expectFooterState(container, "compact");
  });

  it("resets on route changes and reevaluates visibility on the new route", () => {
    const view = renderFooter();
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
    expectFooterState(view.container, "expanded");

    navigationMock.pathname = "/privacy";
    view.rerender(<InteractiveBlobFooter {...footerProps} />);
    expectFooterState(view.container, "compact");

    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
    expectFooterState(view.container, "expanded");
  });

  it("defers a route-change reset until focus leaves the details", () => {
    const view = renderFooter();
    reportIntersection(".blob-footer__viewport-trigger", { ratio: 0.5 });
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

    view.unmount();

    expect(observerRecords.length).toBeGreaterThanOrEqual(1);
    for (const record of observerRecords) expect(record.disconnect).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
