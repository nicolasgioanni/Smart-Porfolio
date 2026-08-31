import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveBlobHeader } from "@/components/layout/InteractiveBlobHeader";
import { MainNavigation } from "@/components/navigation/MainNavigation";
import { SocialLinkGroup } from "@/components/navigation/SocialLinkGroup";
import { MOBILE_UI_QUERY } from "@/components/responsive/useMediaQuery";
import {
  createNavigationItems,
  isNavigationItemActive,
  navigationItems,
  type NavigationItem
} from "@/components/navigation/navigationItems";

const navigationMock = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname
}));

const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
const finePointerQuery = "(hover: hover) and (pointer: fine)";

type MediaQueryListener = (event: MediaQueryListEvent) => void;
type ControlledMediaQuery = {
  addEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  listeners: Set<MediaQueryListener>;
  matches: boolean;
  media: string;
  removeEventListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
};

let controlledMediaQueries = new Map<string, ControlledMediaQuery>();

const headerBrand = {
  initial: "D",
  markImageSrc: "/favicon/favicon.png",
  name: "Demo Owner"
};

const headerNavigationItems: NavigationItem[] = [
  { href: "/", label: "Home" },
  { href: "/research", label: "Research" },
  { href: "/projects", label: "Projects" }
];

const headerLinks = [
  {
    id: "github",
    label: "GitHub",
    url: "https://github.com/example",
    kind: "github",
    isPrimary: true,
    showOnHome: true,
    showInHeader: true,
    showInFooter: true,
    order: 1
  }
];

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value
  });
}

function installMediaQueries({
  finePointer = true,
  mobileUi = false,
  reducedMotion = false
}: { finePointer?: boolean; mobileUi?: boolean; reducedMotion?: boolean } = {}) {
  controlledMediaQueries = new Map();
  const configuredMatches = new Map([
    [finePointerQuery, finePointer],
    [MOBILE_UI_QUERY, mobileUi],
    ["(prefers-reduced-motion: reduce)", reducedMotion]
  ]);

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const existingQuery = controlledMediaQueries.get(query);
      if (existingQuery) return existingQuery as unknown as MediaQueryList;

      const listeners = new Set<MediaQueryListener>();
      const mediaQuery: ControlledMediaQuery = {
        addEventListener: vi.fn((_type: string, listener: MediaQueryListener) => listeners.add(listener)),
        addListener: vi.fn((listener: MediaQueryListener) => listeners.add(listener)),
        listeners,
        matches: configuredMatches.get(query) ?? false,
        media: query,
        removeEventListener: vi.fn((_type: string, listener: MediaQueryListener) => listeners.delete(listener)),
        removeListener: vi.fn((listener: MediaQueryListener) => listeners.delete(listener))
      };
      controlledMediaQueries.set(query, mediaQuery);
      return mediaQuery as unknown as MediaQueryList;
    })
  });
}

function setFinePointer(matches: boolean) {
  installMediaQueries({ finePointer: matches });
}

function setMediaQueryMatches(query: string, matches: boolean) {
  const mediaQuery = controlledMediaQueries.get(query);
  if (!mediaQuery) throw new Error(`Media query was not observed: ${query}`);

  act(() => {
    mediaQuery.matches = matches;
    const event = { matches, media: query } as MediaQueryListEvent;
    mediaQuery.listeners.forEach((listener) => listener(event));
  });
}

function renderHeader() {
  return render(
    <InteractiveBlobHeader brand={headerBrand} initialTheme="navy" navigationItems={headerNavigationItems} primaryLinks={headerLinks} />
  );
}

function scrollToPosition(value: number) {
  act(() => {
    setScrollY(value);
    window.dispatchEvent(new Event("scroll"));
  });
}

function movePointerTo(clientY: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent("pointermove", { clientY }));
  });
}

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({})
  };
}

function createNavigationRouteRects() {
  return new Map([
    ["/", createRect(108, 25, 80, 38)],
    ["/experience", createRect(192, 25, 112, 38)],
    ["/research", createRect(308, 25, 96, 38)],
    ["/projects", createRect(408, 25, 100, 38)],
    ["/resume", createRect(512, 25, 88, 38)]
  ]);
}

function installNavigationGeometryMock(
  indicatorRect: { current: DOMRect },
  routeRectsRef: { current: Map<string, DOMRect> } = { current: createNavigationRouteRects() }
) {

  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: Element) {
    if (this.classList.contains("main-navigation")) return createRect(100, 20, 508, 48);
    if (this.classList.contains("active-route-indicator")) return indicatorRect.current;

    const href = this.getAttribute("href");
    return (href && routeRectsRef.current.get(href)) || createRect(0, 0, 0, 0);
  });
}

function createAnimationMock() {
  return {
    cancel: vi.fn(),
    oncancel: null,
    onfinish: null
  } as unknown as Animation;
}

function installAnimateMock(...animations: Animation[]) {
  const animate = vi.fn();
  animations.forEach((animation) => animate.mockReturnValueOnce(animation));
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
    writable: true
  });
  return animate;
}

describe("navigation helpers", () => {
  beforeEach(() => {
    navigationMock.pathname = "/";
    installMediaQueries();
    setScrollY(0);
  });

  afterEach(() => {
    setScrollY(0);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    if (originalAnimateDescriptor) {
      Object.defineProperty(Element.prototype, "animate", originalAnimateDescriptor);
    } else {
      Reflect.deleteProperty(Element.prototype, "animate");
    }
  });

  it("generates the required route links", () => {
    expect(navigationItems.map((item) => item.href)).toEqual(["/", "/experience", "/research", "/projects", "/recommendations", "/resume"]);
  });

  it("supports content-driven recommendations navigation settings", () => {
    expect(createNavigationItems({ enableRecommendations: false, recommendationsNavLabel: "Recommendations" }).map((item) => item.href)).toEqual([
      "/",
      "/experience",
      "/research",
      "/projects",
      "/resume"
    ]);
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 0 }).map((item) => item.href)).toEqual([
      "/",
      "/experience",
      "/research",
      "/projects",
      "/resume"
    ]);
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 0, showEmptyRecommendations: true }).map((item) => item.href)).toEqual([
      "/",
      "/experience",
      "/research",
      "/projects",
      "/recommendations",
      "/resume"
    ]);
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 1, recommendationsNavLabel: "References" }).find((item) => item.href === "/recommendations")?.label).toBe("References");
  });

  it("detects active routes", () => {
    expect(isNavigationItemActive("/projects", "/projects")).toBe(true);
    expect(isNavigationItemActive("/projects/demo", "/projects")).toBe(true);
    expect(isNavigationItemActive("/research", "/")).toBe(false);
  });

  it("renders one shared desktop indicator and snaps to a direct nested route", () => {
    navigationMock.pathname = "/projects/demo";
    const indicatorRect = { current: createRect(112, 29, 72, 30) };
    installNavigationGeometryMock(indicatorRect);
    const animate = installAnimateMock(createAnimationMock());

    const { container } = render(<MainNavigation items={headerNavigationItems} />);
    const navigation = screen.getByRole("navigation", { name: /main navigation/i });
    const activeLink = screen.getByRole("link", { name: "Projects" });
    const indicator = container.querySelector<HTMLElement>(".active-route-indicator");

    expect(container.querySelectorAll(".active-route-indicator")).toHaveLength(1);
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveClass("hover-base-1", "hover-base-1--route");
    expect(activeLink).not.toHaveClass("hover-base-1--inset");
    expect(navigation).toHaveAttribute("data-route-indicator-ready", "true");
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(indicator).toHaveAttribute("data-visible", "true");
    expect(indicator?.style.transform).toBe("translate3d(308px, 5px, 0)");
    expect(indicator?.style.width).toBe("100px");
    expect(indicator?.style.height).toBe("38px");
    expect(animate).not.toHaveBeenCalled();
  });

  it("animates committed route changes and retargets rapid navigation from the current visual rectangle", () => {
    const indicatorRect = { current: createRect(112, 29, 72, 30) };
    installNavigationGeometryMock(indicatorRect);
    const firstAnimation = createAnimationMock();
    const secondAnimation = createAnimationMock();
    const animate = installAnimateMock(firstAnimation, secondAnimation);
    const view = render(<MainNavigation items={headerNavigationItems} />);

    expect(animate).not.toHaveBeenCalled();

    navigationMock.pathname = "/projects";
    view.rerender(<MainNavigation items={headerNavigationItems} />);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][1]).toEqual({
      duration: 420,
      easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      fill: "none"
    });

    indicatorRect.current = createRect(250, 29, 82, 30);
    navigationMock.pathname = "/research";
    view.rerender(<MainNavigation items={headerNavigationItems} />);

    const secondKeyframes = animate.mock.calls[1][0] as Keyframe[];
    expect(firstAnimation.cancel).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(secondKeyframes[0]).toMatchObject({
      opacity: 0.82,
      transform: "translate3d(150px, 9px, 0) scale(0.8541666666666666, 0.7894736842105263)"
    });
    expect(secondKeyframes[1]).toMatchObject({ opacity: 1, transform: "translate3d(208px, 5px, 0)" });
  });

  it("retargets an active route transition through header geometry changes without extending its deadline", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    const disconnectResizeObserver = vi.fn();

    class ControlledResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      disconnect = disconnectResizeObserver;
      observe = vi.fn();
      unobserve = vi.fn();
    }

    vi.stubGlobal("ResizeObserver", ControlledResizeObserver);

    const currentTime = { value: 0 };
    vi.spyOn(window.performance, "now").mockImplementation(() => currentTime.value);
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    });

    function flushAnimationFrame() {
      const callback = animationFrameCallbacks.shift();
      if (callback) callback(currentTime.value);
    }

    const routeRectsRef = { current: createNavigationRouteRects() };
    const indicatorRect = { current: createRect(112, 29, 72, 30) };
    installNavigationGeometryMock(indicatorRect, routeRectsRef);
    const firstAnimation = createAnimationMock();
    const secondAnimation = createAnimationMock();
    const thirdAnimation = createAnimationMock();
    const animate = installAnimateMock(firstAnimation, secondAnimation, thirdAnimation);
    const view = render(<MainNavigation items={headerNavigationItems} />);

    navigationMock.pathname = "/projects";
    view.rerender(<MainNavigation items={headerNavigationItems} />);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 420 });

    currentTime.value = 160;
    indicatorRect.current = createRect(250, 29, 82, 30);
    routeRectsRef.current.set("/projects", createRect(438, 25, 104, 38));
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
      flushAnimationFrame();
    });

    expect(firstAnimation.cancel).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[1][1]).toMatchObject({ duration: 320 });

    currentTime.value = 300;
    indicatorRect.current = createRect(326, 27, 98, 34);
    routeRectsRef.current.set("/projects", createRect(448, 25, 106, 38));
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
      flushAnimationFrame();
    });

    const finalKeyframes = animate.mock.calls[2][0] as Keyframe[];
    expect(secondAnimation.cancel).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledTimes(3);
    expect(animate.mock.calls[2][1]).toEqual({
      duration: 180,
      easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      fill: "none"
    });
    expect(finalKeyframes[1]).toMatchObject({ opacity: 1, transform: "translate3d(348px, 5px, 0)" });

    view.unmount();
    expect(thirdAnimation.cancel).toHaveBeenCalledOnce();
    expect(disconnectResizeObserver).toHaveBeenCalledOnce();
  });

  it("snaps committed route changes when reduced motion is requested", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        removeEventListener: vi.fn()
      }))
    });
    const indicatorRect = { current: createRect(112, 29, 72, 30) };
    installNavigationGeometryMock(indicatorRect);
    const animate = installAnimateMock(createAnimationMock());
    const view = render(<MainNavigation items={headerNavigationItems} />);

    navigationMock.pathname = "/projects";
    view.rerender(<MainNavigation items={headerNavigationItems} />);

    const indicator = view.container.querySelector<HTMLElement>(".active-route-indicator");
    expect(indicator?.style.transform).toBe("translate3d(308px, 5px, 0)");
    expect(animate).not.toHaveBeenCalled();
  });

  it("hides the shared indicator for an unknown route and snaps when a known target appears", () => {
    navigationMock.pathname = "/not-a-navigation-route";
    const indicatorRect = { current: createRect(0, 0, 0, 0) };
    installNavigationGeometryMock(indicatorRect);
    const animate = installAnimateMock(createAnimationMock());
    const view = render(<MainNavigation items={headerNavigationItems} />);

    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
    expect(view.container.querySelector(".active-route-indicator")).toHaveAttribute("data-visible", "false");

    navigationMock.pathname = "/research";
    view.rerender(<MainNavigation items={headerNavigationItems} />);

    expect(screen.getByRole("link", { name: "Research" })).toHaveAttribute("aria-current", "page");
    expect(view.container.querySelector(".active-route-indicator")).toHaveAttribute("data-visible", "true");
    expect(animate).not.toHaveBeenCalled();
  });

  it("renders descriptive social links", () => {
    render(
      <SocialLinkGroup
        links={[
          {
            id: "github",
            label: "GitHub",
            url: "https://github.com/example",
            kind: "github",
            isPrimary: true,
            showOnHome: true,
            showInHeader: true,
            showInFooter: true,
            order: 1
          }
        ]}
      />
    );

    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("href", "https://github.com/example");
  });

  it("renders the interactive header expanded by default", () => {
    const { container } = renderHeader();

    expect(container.querySelector(".blob-header")).toHaveAttribute("data-header-state", "expanded");
    expect(container.querySelector(".site-brand__mark")).toHaveClass("site-brand__mark--image");
    expect(container.querySelector(".site-brand__mark-image")).toHaveAttribute("src", "/favicon/favicon.png");
    expect(screen.getByRole("button", { name: /view demo owner profile photo/i })).toHaveClass(
      "hover-base-1",
      "hover-base-1--compact",
      "hover-base-1--solid",
      "hover-base-1--no-wave"
    );
    const brandText = container.querySelector(".site-brand__text");
    expect(brandText?.tagName).toBe("SPAN");
    expect(brandText).toHaveTextContent("Demo Owner");
    expect(brandText).not.toHaveClass("hover-base-1");
    expect(screen.queryByRole("link", { name: /demo owner home/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /menu/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose color theme/i })).toHaveClass(
      "glass-icon-button",
      "hover-base-1",
      "hover-base-1--compact"
    );
    expect(
      container.querySelector(
        ".blob-header__island > .site-brand + .main-navigation + .mobile-navigation"
      )
    ).not.toBeNull();
    const mobileRail = container.querySelector(".mobile-navigation");
    expect(mobileRail?.querySelector(":scope > .mobile-navigation__routes + .blob-header__actions")).not.toBeNull();
    expect(screen.getByRole("link", { name: /github/i })).toHaveClass("hover-base-1", "hover-base-1--compact");
  });

  it("renders the canonical routes and actions inside one mobile rail", () => {
    installMediaQueries({ mobileUi: true });
    const { container } = renderHeader();
    const mobileNavigation = screen.getByRole("navigation", { name: /mobile navigation/i });
    const mobileLinks = within(mobileNavigation).getAllByRole("link");
    const mobileRail = container.querySelector(".mobile-navigation.mobile-navigation__rail");
    const actionCluster = container.querySelector(".blob-header__actions");

    expect(mobileLinks.map((link) => link.textContent)).toEqual(["Home", "Research", "Projects"]);
    expect(mobileLinks[0]).toHaveAttribute("aria-current", "page");
    expect(container.querySelector(".mobile-navigation__panel")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /menu/i })).not.toBeInTheDocument();
    expect(mobileRail).not.toBeNull();
    expect(mobileNavigation.parentElement).toBe(mobileRail);
    expect(actionCluster?.parentElement).toBe(mobileRail);
    expect(mobileNavigation.nextElementSibling).toBe(actionCluster);
    expect(within(mobileNavigation).queryByRole("link", { name: /github/i })).not.toBeInTheDocument();
    expect(within(actionCluster as HTMLElement).getByRole("link", { name: /github/i })).toBeInTheDocument();
    expect(within(actionCluster as HTMLElement).getByRole("button", { name: /choose color theme/i })).toBeInTheDocument();
  });

  it("opens the profile photo preview and closes when clicking outside the frame", async () => {
    const { container } = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: /view demo owner profile photo/i }));
    expect(screen.getByRole("dialog", { name: /demo owner profile photo/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /demo owner profile photo/i })).toHaveAttribute("src", "/favicon/favicon.png");
    expect(screen.getByRole("button", { name: /close profile photo preview/i })).toHaveClass(
      "hover-base-1",
      "hover-base-1--compact"
    );

    fireEvent.click(screen.getByRole("img", { name: /demo owner profile photo/i }));
    expect(screen.getByRole("dialog", { name: /demo owner profile photo/i })).toBeInTheDocument();

    const backdrop = container.querySelector(".profile-image-preview");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(backdrop).toHaveAttribute("data-state", "closed");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /demo owner profile photo/i })).not.toBeInTheDocument());
  });

  it("closes the profile photo preview with Escape", async () => {
    const { container } = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: /view demo owner profile photo/i }));
    expect(screen.getByRole("dialog", { name: /demo owner profile photo/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".profile-image-preview")).toHaveAttribute("data-state", "closed");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /demo owner profile photo/i })).not.toBeInTheDocument());
  });

  it("closes an open profile photo preview when the header enters mobile UI mode", async () => {
    const { container } = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: /view demo owner profile photo/i }));
    expect(screen.getByRole("dialog", { name: /demo owner profile photo/i })).toBeInTheDocument();

    setMediaQueryMatches(MOBILE_UI_QUERY, true);

    expect(container.querySelector(".profile-image-preview")).toHaveAttribute("data-state", "closed");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /demo owner profile photo/i })).not.toBeInTheDocument());
  });

  it("shrinks on downward scroll and expands on upward scroll", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(120);
    expect(header).toHaveAttribute("data-header-state", "compact");

    scrollToPosition(80);
    expect(header).toHaveAttribute("data-header-state", "expanded");

    movePointerTo(220);
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });

  it("ignores scroll and pointer geometry changes in mobile UI mode and restores desktop behavior", () => {
    installMediaQueries({ mobileUi: true });
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(160);
    movePointerTo(24);
    movePointerTo(240);
    scrollToPosition(220);
    expect(header).toHaveAttribute("data-header-state", "expanded");
    expect(header).not.toHaveClass("blob-header--compact");

    setMediaQueryMatches(MOBILE_UI_QUERY, false);
    expect(header).toHaveAttribute("data-header-state", "compact");

    scrollToPosition(160);
    expect(header).toHaveAttribute("data-header-state", "expanded");
    scrollToPosition(220);
    expect(header).toHaveAttribute("data-header-state", "compact");
  });

  it("expands near the top proximity zone and compacts again when the pointer moves away", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    movePointerTo(24);
    expect(header).toHaveAttribute("data-header-state", "expanded");

    movePointerTo(220);
    expect(header).toHaveAttribute("data-header-state", "compact");
  });

  it("expands when focus moves into the header", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    fireEvent.focus(within(screen.getByRole("navigation", { name: /main navigation/i })).getByRole("link", { name: "Home" }));
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });

  it("enters mobile UI mode expanded and remains stable while the route rail is used", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    setMediaQueryMatches(MOBILE_UI_QUERY, true);
    expect(header).toHaveAttribute("data-header-state", "expanded");

    const mobileNavigation = screen.getByRole("navigation", { name: /mobile navigation/i });
    expect(screen.queryByRole("button", { name: /menu/i })).not.toBeInTheDocument();
    container.querySelectorAll(".mobile-navigation__link").forEach((link) => {
      expect(link).toHaveClass("hover-base-1", "hover-base-1--compact");
    });
    fireEvent.focus(within(mobileNavigation).getByRole("link", { name: "Research" }));
    expect(header).toHaveAttribute("data-header-state", "expanded");

    scrollToPosition(190);
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });

  it("keeps the header geometry stable while the desktop theme menu is open", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");
    const themeTrigger = screen.getByRole("button", { name: /choose color theme/i });

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    fireEvent.click(themeTrigger);
    expect(themeTrigger).toHaveAttribute("aria-expanded", "true");
    expect(header).toHaveAttribute("data-header-state", "compact");

    scrollToPosition(190);
    expect(header).toHaveAttribute("data-header-state", "compact");

    fireEvent.pointerDown(document.body);
    expect(themeTrigger).toHaveAttribute("aria-expanded", "false");
    expect(header).toHaveAttribute("data-header-state", "compact");

    fireEvent.click(themeTrigger);
    fireEvent.keyDown(themeTrigger, { key: "Escape" });
    expect(themeTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the bottom dock expanded while the mobile theme disclosure opens and closes", () => {
    installMediaQueries({ mobileUi: true });
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");
    const themeTrigger = screen.getByRole("button", { name: /choose color theme/i });

    fireEvent.click(themeTrigger);
    expect(themeTrigger).toHaveAttribute("aria-expanded", "true");
    const themePopover = document.body.querySelector(".theme-switcher__popover--portal");
    expect(themePopover).not.toBeNull();
    expect(themePopover?.parentElement).toBe(document.body);
    scrollToPosition(180);
    expect(header).toHaveAttribute("data-header-state", "expanded");

    fireEvent.pointerDown(document.body);
    expect(themeTrigger).toHaveAttribute("aria-expanded", "false");
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });

  it("uses scroll direction instead of pointer proximity on coarse pointer devices", () => {
    setFinePointer(false);
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    movePointerTo(24);
    expect(header).toHaveAttribute("data-header-state", "compact");

    scrollToPosition(100);
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });
});
