import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOBILE_NAVIGATION_DRIFT_PX_PER_SECOND,
  MOBILE_NAVIGATION_IDLE_DELAY_MS,
  MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS,
  MOBILE_NAVIGATION_RETURN_DURATION_MS,
  MobileNavigation
} from "@/components/navigation/MobileNavigation";
import { navigationItems } from "@/components/navigation/navigationItems";
import { MOBILE_UI_QUERY } from "@/components/responsive/useMediaQuery";

const navigationMock = vi.hoisted(() => ({ pathname: "/projects" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname
}));

type RailGeometry = {
  clientWidth: number;
  scrollWidth: number;
};

let animationFrames = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;
let now = 0;
let resizeCallback: ResizeObserverCallback | null = null;
let resizeDisconnect: ReturnType<typeof vi.fn>;
let mobileUi = true;
let reducedMotion = false;
let mediaQueries = new Map<string, {
  listeners: Set<(event: MediaQueryListEvent) => void>;
  matches: boolean;
}>();

function setRailGeometry(rail: HTMLElement, geometry: RailGeometry) {
  Object.defineProperties(rail, {
    clientWidth: { configurable: true, value: geometry.clientWidth },
    scrollWidth: { configurable: true, value: geometry.scrollWidth }
  });
}

function createRect(left: number, width: number): DOMRect {
  return {
    bottom: 44,
    height: 44,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({})
  };
}

function notifyResize() {
  act(() => {
    resizeCallback?.([], {} as ResizeObserver);
  });
}

function flushAnimationFrame(timestamp: number) {
  now = timestamp;
  const frame = animationFrames.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (!frame) return;

  animationFrames.delete(frame[0]);
  act(() => frame[1](timestamp));
}

function advanceIdleTimer(milliseconds: number, timestamp: number) {
  now = timestamp;
  act(() => vi.advanceTimersByTime(milliseconds));
}

function setMediaPreference(query: string, matches: boolean) {
  const mediaQuery = mediaQueries.get(query);
  if (!mediaQuery) throw new Error(`Media query was not observed: ${query}`);

  act(() => {
    mediaQuery.matches = matches;
    const event = { matches, media: query } as MediaQueryListEvent;
    mediaQuery.listeners.forEach((listener) => listener(event));
  });
}

function renderOverflowingRail(scrollLeft = 0) {
  const view = render(<MobileNavigation items={navigationItems} />);
  const routes = screen.getByRole("navigation", { name: "Mobile navigation" });
  const rail = routes.closest<HTMLElement>(".mobile-navigation__rail");
  if (!rail) throw new Error("The mobile navigation rail was not rendered.");
  setRailGeometry(rail, { clientWidth: 200, scrollWidth: 400 });
  rail.scrollLeft = scrollLeft;
  notifyResize();
  return { ...view, rail, routes };
}

beforeEach(() => {
  vi.useFakeTimers();
  animationFrames = new Map();
  nextAnimationFrameId = 1;
  now = 0;
  resizeCallback = null;
  resizeDisconnect = vi.fn();
  mobileUi = true;
  reducedMotion = false;
  mediaQueries = new Map();
  navigationMock.pathname = "/projects";

  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible"
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      let controlledQuery = mediaQueries.get(query);

      if (!controlledQuery) {
        controlledQuery = {
          listeners: new Set(),
          matches: query === MOBILE_UI_QUERY ? mobileUi : reducedMotion
        };
        mediaQueries.set(query, controlledQuery);
      }

      return {
        addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
          controlledQuery.listeners.add(listener);
        }),
        matches: controlledQuery.matches,
        media: query,
        removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
          controlledQuery.listeners.delete(listener);
        })
      };
    })
  });

  vi.spyOn(window.performance, "now").mockImplementation(() => now);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const frameId = nextAnimationFrameId++;
    animationFrames.set(frameId, callback);
    return frameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
    animationFrames.delete(frameId);
  });

  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      disconnect = resizeDisconnect;
      observe = vi.fn();
      unobserve = vi.fn();
    }
  );
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MobileNavigation", () => {
  it("renders one canonical route list with the current route identified", () => {
    render(<MobileNavigation items={navigationItems} />);

    const navigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    const rail = navigation.closest(".mobile-navigation__rail");
    const links = within(navigation).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Home",
      "Experience",
      "Research",
      "Projects",
      "Recommendations",
      "Resume"
    ]);
    expect(within(navigation).getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(navigation).toHaveClass("mobile-navigation__routes");
    expect(rail).toHaveClass("mobile-navigation", "mobile-navigation__rail");
    expect(rail).toHaveAttribute("data-edge", "none");
    expect(rail).toHaveAttribute("data-overflow", "false");
  });

  it("places the route navigation and action slot inside one scrolling rail", () => {
    render(
      <MobileNavigation
        actions={<div className="blob-header__actions"><button type="button">Theme</button></div>}
        items={navigationItems}
      />
    );

    const routes = screen.getByRole("navigation", { name: "Mobile navigation" });
    const rail = routes.closest(".mobile-navigation__rail");
    const themeButton = screen.getByRole("button", { name: "Theme" });

    expect(rail).toContainElement(routes);
    expect(rail).toContainElement(themeButton);
    expect(routes.nextElementSibling).toContainElement(themeButton);
  });

  it("updates logical fade edges when native scrolling and geometry change", () => {
    const { rail } = renderOverflowingRail();

    expect(rail).toHaveAttribute("data-edge", "end");
    expect(rail).toHaveAttribute("data-overflow", "true");

    rail.scrollLeft = 80;
    fireEvent.scroll(rail);
    expect(rail).toHaveAttribute("data-edge", "both");

    rail.scrollLeft = 200;
    fireEvent.scroll(rail);
    expect(rail).toHaveAttribute("data-edge", "start");

    setRailGeometry(rail, { clientWidth: 400, scrollWidth: 400 });
    notifyResize();
    expect(rail).toHaveAttribute("data-edge", "none");
    expect(rail).toHaveAttribute("data-overflow", "false");
  });

  it("centers a newly active deep link inside the rail without scrolling the page", () => {
    navigationMock.pathname = "/";
    const view = render(<MobileNavigation items={navigationItems} />);
    const routes = screen.getByRole("navigation", { name: "Mobile navigation" });
    const rail = routes.closest<HTMLElement>(".mobile-navigation__rail");
    if (!rail) throw new Error("The mobile navigation rail was not rendered.");
    const researchLink = within(routes).getByRole("link", { name: "Research" });
    const pageScroll = vi.spyOn(window, "scrollTo");
    setRailGeometry(rail, { clientWidth: 200, scrollWidth: 400 });
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue(createRect(0, 200));
    vi.spyOn(researchLink, "getBoundingClientRect").mockReturnValue(createRect(240, 80));

    navigationMock.pathname = "/research";
    view.rerender(<MobileNavigation items={navigationItems} />);

    expect(rail.scrollLeft).toBe(180);
    expect(rail).toHaveAttribute("data-edge", "both");
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it("keeps the initial pathname delay when active-route centering emits a scroll event", () => {
    navigationMock.pathname = "/";
    const view = render(<MobileNavigation items={navigationItems} />);
    const routes = screen.getByRole("navigation", { name: "Mobile navigation" });
    const rail = routes.closest<HTMLElement>(".mobile-navigation__rail");
    if (!rail) throw new Error("The mobile navigation rail was not rendered.");
    const researchLink = within(routes).getByRole("link", { name: "Research" });
    setRailGeometry(rail, { clientWidth: 200, scrollWidth: 400 });
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue(createRect(0, 200));
    vi.spyOn(researchLink, "getBoundingClientRect").mockReturnValue(createRect(240, 80));

    navigationMock.pathname = "/research";
    view.rerender(<MobileNavigation items={navigationItems} />);
    fireEvent.scroll(rail);

    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS - 1, MOBILE_NAVIGATION_IDLE_DELAY_MS - 1);
    expect(animationFrames).toHaveLength(0);
    advanceIdleTimer(1, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    expect(animationFrames).toHaveLength(1);
  });

  it("returns to Home after the idle delay, then drifts using elapsed frame time", () => {
    const { rail } = renderOverflowingRail(120);

    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS - 1, MOBILE_NAVIGATION_IDLE_DELAY_MS - 1);
    expect(animationFrames).toHaveLength(0);
    expect(rail.scrollLeft).toBe(120);

    advanceIdleTimer(1, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    expect(animationFrames).toHaveLength(1);
    expect(rail).toHaveAttribute("data-automating");

    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + MOBILE_NAVIGATION_RETURN_DURATION_MS / 2);
    expect(rail.scrollLeft).toBeCloseTo(60);

    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + MOBILE_NAVIGATION_RETURN_DURATION_MS);
    expect(rail.scrollLeft).toBe(0);
    expect(animationFrames).toHaveLength(1);

    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + MOBILE_NAVIGATION_RETURN_DURATION_MS + 1000);
    expect(rail.scrollLeft).toBeCloseTo(MOBILE_NAVIGATION_DRIFT_PX_PER_SECOND);
    expect(rail).toHaveAttribute("data-edge", "both");
  });

  it("reverses drift cleanly at both overflow boundaries", () => {
    const { rail } = renderOverflowingRail();
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);

    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 10_000);
    expect(rail.scrollLeft).toBe(200);

    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 11_000);
    expect(rail.scrollLeft).toBe(180);

    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 20_000);
    expect(rail.scrollLeft).toBe(0);
    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 21_000);
    expect(rail.scrollLeft).toBe(20);
  });

  it("accumulates subpixel drift when the browser rounds scrollLeft writes", () => {
    const { rail } = renderOverflowingRail();
    let browserScrollLeft = 0;

    Object.defineProperty(rail, "scrollLeft", {
      configurable: true,
      get: () => browserScrollLeft,
      set: (value: number) => {
        browserScrollLeft = Math.round(value);
      }
    });

    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 16);
    expect(rail.scrollLeft).toBe(0);

    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 32);
    expect(rail.scrollLeft).toBe(1);
  });

  it("does not treat scroll events caused by automation as user interaction", () => {
    const { rail } = renderOverflowingRail();
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 1000);
    expect(rail.scrollLeft).toBe(20);

    fireEvent.scroll(rail);
    expect(rail).toHaveAttribute("data-automating");
    expect(animationFrames).toHaveLength(1);

    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 2000);
    expect(rail.scrollLeft).toBe(40);
  });

  it("pauses active drift when a scroll event moves away from its automated position", () => {
    const { rail } = renderOverflowingRail();
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 1000);

    rail.scrollLeft = 75;
    fireEvent.scroll(rail);
    expect(rail).not.toHaveAttribute("data-automating");
    expect(animationFrames).toHaveLength(0);

    advanceIdleTimer(
      MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS,
      MOBILE_NAVIGATION_IDLE_DELAY_MS + 1000 + MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS
    );
    expect(animationFrames).toHaveLength(1);
  });

  it.each([
    ["pointer", (rail: HTMLElement) => fireEvent.pointerDown(rail)],
    ["touch", (rail: HTMLElement) => fireEvent.touchStart(rail)],
    ["scroll", (rail: HTMLElement) => {
      rail.scrollLeft = 90;
      fireEvent.scroll(rail);
    }],
    ["wheel", (rail: HTMLElement) => fireEvent.wheel(rail)],
    ["keyboard", (rail: HTMLElement) => fireEvent.keyDown(rail, { key: "ArrowRight" })],
    ["focus", (rail: HTMLElement) => fireEvent.focus(within(rail).getByRole("link", { name: "Home" }))]
  ])("pauses after %s interaction and resumes drift after five seconds", (_label, interact) => {
    const { rail } = renderOverflowingRail(80);

    interact(rail);
    advanceIdleTimer(
      MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS - 1,
      MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS - 1
    );

    expect(animationFrames).toHaveLength(0);
    expect(rail.scrollLeft).toBe(_label === "scroll" ? 90 : 80);
    expect(rail).not.toHaveAttribute("data-automating");

    advanceIdleTimer(1, MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS);
    expect(animationFrames).toHaveLength(1);
    expect(rail).toHaveAttribute("data-automating");
  });

  it("restarts the five-second inactivity delay after every interaction", () => {
    const { rail } = renderOverflowingRail(80);

    fireEvent.pointerDown(rail);
    advanceIdleTimer(4000, 4000);
    fireEvent.wheel(rail);
    advanceIdleTimer(MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS - 1, 8999);
    expect(animationFrames).toHaveLength(0);

    advanceIdleTimer(1, 9000);
    expect(animationFrames).toHaveLength(1);
  });

  it("resumes from the current position in the direction used before interaction", () => {
    const { rail } = renderOverflowingRail();
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 10_000);
    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 10_016);
    expect(rail.scrollLeft).toBeCloseTo(199.68);

    rail.scrollLeft = 150;
    fireEvent.pointerDown(rail);
    advanceIdleTimer(MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS, 18_016);
    flushAnimationFrame(19_016);

    expect(rail.scrollLeft).toBeCloseTo(130);
  });

  it("holds while externally paused and starts a fresh resume delay after release", () => {
    const view = render(
      <MobileNavigation externalPaused items={navigationItems} />
    );
    const routes = screen.getByRole("navigation", { name: "Mobile navigation" });
    const rail = routes.closest<HTMLElement>(".mobile-navigation__rail");
    if (!rail) throw new Error("The mobile navigation rail was not rendered.");
    setRailGeometry(rail, { clientWidth: 200, scrollWidth: 400 });
    rail.scrollLeft = 80;
    notifyResize();

    advanceIdleTimer(10_000, 10_000);
    expect(animationFrames).toHaveLength(0);

    view.rerender(<MobileNavigation externalPaused={false} items={navigationItems} />);
    advanceIdleTimer(
      MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS - 1,
      10_000 + MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS - 1
    );
    expect(animationFrames).toHaveLength(0);
    expect(rail.scrollLeft).toBe(80);

    advanceIdleTimer(1, 10_000 + MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS);
    expect(animationFrames).toHaveLength(1);
    expect(rail).toHaveAttribute("data-automating");
  });

  it("holds active drift for an external pause and resumes from the same position", () => {
    const view = renderOverflowingRail();
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    flushAnimationFrame(MOBILE_NAVIGATION_IDLE_DELAY_MS + 1000);
    expect(view.rail.scrollLeft).toBe(20);

    view.rerender(<MobileNavigation externalPaused items={navigationItems} />);
    expect(animationFrames).toHaveLength(0);
    expect(view.rail).not.toHaveAttribute("data-automating");
    advanceIdleTimer(10_000, 14_000);
    expect(view.rail.scrollLeft).toBe(20);

    view.rerender(<MobileNavigation externalPaused={false} items={navigationItems} />);
    advanceIdleTimer(MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS - 1, 18_999);
    expect(animationFrames).toHaveLength(0);
    advanceIdleTimer(1, 19_000);
    flushAnimationFrame(20_000);
    expect(view.rail.scrollLeft).toBe(40);
  });

  it("cancels on breakpoint exit and starts a fresh idle cycle on mobile return", () => {
    renderOverflowingRail(80);
    advanceIdleTimer(1000, 1000);

    setMediaPreference(MOBILE_UI_QUERY, false);
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, 4000);
    expect(animationFrames).toHaveLength(0);

    setMediaPreference(MOBILE_UI_QUERY, true);
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS - 1, 6999);
    expect(animationFrames).toHaveLength(0);
    advanceIdleTimer(1, 7000);
    expect(animationFrames).toHaveLength(1);
  });

  it("resets interaction waiting to the initial idle cycle when the pathname changes", () => {
    const view = renderOverflowingRail(80);
    fireEvent.pointerDown(view.rail);
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    expect(animationFrames).toHaveLength(0);

    navigationMock.pathname = "/research";
    view.rerender(<MobileNavigation items={navigationItems} />);
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS * 2);

    expect(animationFrames).toHaveLength(1);
    expect(within(view.rail).getByRole("link", { name: "Research" })).toHaveAttribute("aria-current", "page");
  });

  it("pauses the idle countdown while the document is hidden", () => {
    renderOverflowingRail(80);
    advanceIdleTimer(1000, 1000);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    advanceIdleTimer(5000, 6000);
    expect(animationFrames).toHaveLength(0);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    advanceIdleTimer(1999, 7999);
    expect(animationFrames).toHaveLength(0);
    advanceIdleTimer(1, 8000);
    expect(animationFrames).toHaveLength(1);
  });

  it("pauses the interaction resume countdown while the document is hidden", () => {
    const { rail } = renderOverflowingRail(80);
    fireEvent.pointerDown(rail);
    advanceIdleTimer(2000, 2000);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    advanceIdleTimer(10_000, 12_000);
    expect(animationFrames).toHaveLength(0);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    advanceIdleTimer(2999, 14_999);
    expect(animationFrames).toHaveLength(0);
    advanceIdleTimer(1, 15_000);
    expect(animationFrames).toHaveLength(1);
  });

  it("preserves the interaction resume countdown while overflow is unavailable", () => {
    const { rail } = renderOverflowingRail(80);
    fireEvent.pointerDown(rail);
    advanceIdleTimer(2000, 2000);

    setRailGeometry(rail, { clientWidth: 400, scrollWidth: 400 });
    notifyResize();
    advanceIdleTimer(10_000, 12_000);
    expect(animationFrames).toHaveLength(0);

    setRailGeometry(rail, { clientWidth: 200, scrollWidth: 400 });
    notifyResize();
    advanceIdleTimer(2999, 14_999);
    expect(animationFrames).toHaveLength(0);
    advanceIdleTimer(1, 15_000);
    expect(animationFrames).toHaveLength(1);
  });

  it.each([
    ["desktop", false, false],
    ["reduced motion", true, true]
  ])("does not automate in %s mode", (_label, usesMobileUi, reducesMotion) => {
    mobileUi = usesMobileUi;
    reducedMotion = reducesMotion;
    const { rail } = renderOverflowingRail(80);

    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);

    expect(animationFrames).toHaveLength(0);
    expect(rail.scrollLeft).toBe(80);
  });

  it("disconnects observation and cancels scheduled work on unmount", () => {
    const view = renderOverflowingRail(80);
    advanceIdleTimer(MOBILE_NAVIGATION_IDLE_DELAY_MS, MOBILE_NAVIGATION_IDLE_DELAY_MS);
    expect(animationFrames).toHaveLength(1);

    view.unmount();

    expect(resizeDisconnect).toHaveBeenCalledOnce();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(animationFrames).toHaveLength(0);
  });

  it("clears a pending interaction resume timer on unmount", () => {
    const clearTimeout = vi.spyOn(globalThis, "clearTimeout");
    const setTimeout = vi.spyOn(globalThis, "setTimeout");
    const view = renderOverflowingRail(80);
    fireEvent.pointerDown(view.rail);
    const resumeTimerCallIndex = setTimeout.mock.calls.findIndex(
      ([, delay]) => delay === MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS
    );
    const resumeTimerId = setTimeout.mock.results[resumeTimerCallIndex]?.value;

    expect(resumeTimerCallIndex).toBeGreaterThanOrEqual(0);
    view.unmount();

    expect(clearTimeout).toHaveBeenCalledWith(resumeTimerId);
    expect(animationFrames).toHaveLength(0);
    vi.clearAllTimers();
  });

  it("removes the idle timer and visibility listener when the breakpoint exits", () => {
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const clearTimeout = vi.spyOn(globalThis, "clearTimeout");
    const setTimeout = vi.spyOn(globalThis, "setTimeout");
    const view = renderOverflowingRail(80);
    const idleTimerCallIndex = setTimeout.mock.calls.findIndex(
      ([, delay]) => delay === MOBILE_NAVIGATION_IDLE_DELAY_MS
    );
    const idleTimerId = setTimeout.mock.results[idleTimerCallIndex]?.value;

    expect(idleTimerCallIndex).toBeGreaterThanOrEqual(0);
    setMediaPreference(MOBILE_UI_QUERY, false);

    expect(clearTimeout).toHaveBeenCalledWith(idleTimerId);
    expect(removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(resizeDisconnect).toHaveBeenCalledOnce();

    view.unmount();
    vi.clearAllTimers();
  });
});
