import { act, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnimatedRole,
  animatedRoleEasing,
  animatedRoleFlipDegrees,
  animatedRoleHoldMs,
  animatedRoleTransitionMs,
  animatedRoleVerticalOffsetPx
} from "@/components/portfolio/AnimatedRole";
import type { ProfileOverviewRole } from "@/content/types";

const rotatingRole: ProfileOverviewRole = {
  alternate: "Research Scientist",
  engineerPrefixes: ["Software", "AI", "Security"],
  engineerSuffix: "Engineer",
  kind: "rotating"
};

const staticRole: ProfileOverviewRole = {
  kind: "static",
  label: "Software Engineer"
};

function installReducedMotionPreference(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let reducedMotion = matches;
  const mediaQuery = {
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    get matches() {
      return reducedMotion;
    },
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    removeListener: vi.fn()
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

  return (nextMatches: boolean) => {
    reducedMotion = nextMatches;
    const event = { matches: nextMatches, media: mediaQuery.media } as MediaQueryListEvent;
    listeners.forEach((listener) => listener(event));
  };
}

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

describe("AnimatedRole", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installReducedMotionPreference(false);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("server-renders the first configured role with one stable accessible label", () => {
    const markup = renderToStaticMarkup(<AnimatedRole role={rotatingRole} />);

    expect(markup).toContain("Software Engineer");
    expect(markup).toContain('class="profile-role__accessible visually-hidden"');
    expect(markup).not.toContain("aria-live");
  });

  it("uses the slower vertical-flip timing without shortening either phase", () => {
    const { container } = render(<AnimatedRole role={rotatingRole} />);
    const root = container.querySelector(".profile-role");

    expect(animatedRoleHoldMs).toBe(3400);
    expect(animatedRoleTransitionMs).toBe(640);
    expect(animatedRoleVerticalOffsetPx).toBe(8);
    expect(animatedRoleFlipDegrees).toBe(70);
    expect(animatedRoleEasing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(root).toHaveAttribute("data-hold-ms", "3400");
    expect(root).toHaveAttribute("data-transition-ms", "640");
    expect(root).toHaveAttribute("data-offset-px", "8");
    expect(root).toHaveAttribute("data-flip-degrees", "70");
    expect(root).toHaveAttribute("data-easing", animatedRoleEasing);

    advance(animatedRoleHoldMs - 1);
    expect(root).toHaveAttribute("data-phase", "idle");

    advance(1);
    expect(root).toHaveAttribute("data-phase", "transition");

    advance(animatedRoleTransitionMs - 1);
    expect(root).toHaveAttribute("data-phase", "transition");

    advance(1);
    expect(root).toHaveAttribute("data-current-role", "AI Engineer");
    expect(root).toHaveAttribute("data-phase", "idle");
  });

  it("renders a static fallback without scheduling rotation", () => {
    const { container } = render(<AnimatedRole role={staticRole} />);
    const root = container.querySelector(".profile-role");

    expect(root).toHaveAttribute("data-mode", "static");
    expect(root).toHaveAttribute("data-phase", "static");
    expect(root).toHaveAttribute("data-motion-enabled", "false");
    expect(container.querySelector(".profile-role__static")).toHaveTextContent("Software Engineer");
    expect(container.querySelector(".profile-role__window")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("swaps engineer prefixes while preserving the suffix node", () => {
    const { container } = render(<AnimatedRole role={rotatingRole} />);
    const root = container.querySelector(".profile-role");
    const suffix = container.querySelector(".profile-role__suffix");

    expect(root).toHaveAttribute("data-current-role", "Software Engineer");
    expect(root).toHaveAttribute("data-mode", "prefix");
    expect(root).toHaveAttribute("data-phase", "idle");
    expect(suffix).toHaveTextContent("Engineer");

    advance(animatedRoleHoldMs);

    expect(root).toHaveAttribute("data-mode", "prefix");
    expect(root).toHaveAttribute("data-phase", "transition");
    expect(root).toHaveAttribute("data-next-role", "AI Engineer");
    expect(container.querySelector('.profile-role__prefix[data-prefix-index="0"]')).toHaveAttribute(
      "data-state",
      "outgoing"
    );
    expect(container.querySelector('.profile-role__prefix[data-prefix-index="1"]')).toHaveAttribute(
      "data-state",
      "incoming"
    );
    expect(container.querySelector(".profile-role__suffix")).toBe(suffix);

    advance(animatedRoleTransitionMs);

    expect(root).toHaveAttribute("data-current-role", "AI Engineer");
    expect(root).toHaveAttribute("data-phase", "idle");
    expect(container.querySelector('.profile-role__prefix[data-prefix-index="1"]')).toHaveAttribute(
      "data-state",
      "active"
    );
    expect(container.querySelector(".profile-role__suffix")).toBe(suffix);

    advance(animatedRoleHoldMs);

    expect(root).toHaveAttribute("data-next-role", "Security Engineer");
    expect(container.querySelector('.profile-role__prefix[data-prefix-index="1"]')).toHaveAttribute(
      "data-state",
      "outgoing"
    );
    expect(container.querySelector('.profile-role__prefix[data-prefix-index="2"]')).toHaveAttribute(
      "data-state",
      "incoming"
    );
    expect(container.querySelector(".profile-role__suffix")).toBe(suffix);

    advance(animatedRoleTransitionMs);

    expect(root).toHaveAttribute("data-current-role", "Security Engineer");
    expect(container.querySelector(".profile-role__suffix")).toBe(suffix);
  });

  it("uses whole-line transitions at both alternate-role boundaries and loops", () => {
    const { container } = render(<AnimatedRole role={rotatingRole} />);
    const root = container.querySelector(".profile-role");
    const roleWindow = container.querySelector(".profile-role__window");
    const roleSizer = container.querySelector(".profile-role__sizer");

    expect(Array.from(container.querySelectorAll(".profile-role__sizer-label")).map((node) => node.textContent)).toEqual([
      "Software Engineer",
      "AI Engineer",
      "Security Engineer",
      "Research Scientist"
    ]);

    advance(animatedRoleHoldMs);
    advance(animatedRoleTransitionMs);
    advance(animatedRoleHoldMs);
    advance(animatedRoleTransitionMs);
    expect(root).toHaveAttribute("data-current-role", "Security Engineer");

    advance(animatedRoleHoldMs);
    expect(root).toHaveAttribute("data-mode", "line");
    expect(root).toHaveAttribute("data-phase", "transition");
    expect(root).toHaveAttribute("data-next-role", "Research Scientist");
    expect(container.querySelector(".profile-role__engineer-line")).toHaveAttribute("data-state", "outgoing");
    expect(container.querySelector(".profile-role__alternate")).toHaveAttribute("data-state", "incoming");

    advance(animatedRoleTransitionMs);
    expect(root).toHaveAttribute("data-current-role", "Research Scientist");
    expect(root).toHaveAttribute("data-mode", "alternate");
    expect(container.querySelector(".profile-role__alternate")).toHaveAttribute("data-state", "active");

    advance(animatedRoleHoldMs);
    expect(root).toHaveAttribute("data-mode", "line");
    expect(root).toHaveAttribute("data-next-role", "Software Engineer");
    expect(container.querySelector(".profile-role__alternate")).toHaveAttribute("data-state", "outgoing");
    expect(container.querySelector(".profile-role__engineer-line")).toHaveAttribute("data-state", "incoming");
    expect(container.querySelector('.profile-role__prefix[data-prefix-index="0"]')).toHaveAttribute(
      "data-state",
      "active"
    );

    advance(animatedRoleTransitionMs);
    expect(root).toHaveAttribute("data-current-role", "Software Engineer");
    expect(root).toHaveAttribute("data-mode", "prefix");
    expect(root).toHaveAttribute("data-phase", "idle");
    expect(container.querySelector(".profile-role__window")).toBe(roleWindow);
    expect(container.querySelector(".profile-role__sizer")).toBe(roleSizer);
  });

  it("does not rotate when its explicit motion override is disabled", () => {
    const { container } = render(<AnimatedRole motionEnabled={false} role={rotatingRole} />);

    expect(container.querySelector(".profile-role")).toHaveAttribute("data-mode", "static");
    expect(container.querySelector(".profile-role__static")).toHaveTextContent("Software Engineer");
    expect(vi.getTimerCount()).toBe(0);

    advance(animatedRoleHoldMs + animatedRoleTransitionMs);
    expect(container.querySelector(".profile-role")).toHaveAttribute("data-current-role", "Software Engineer");
  });

  it("does not schedule rotation for a reduced-motion preference", () => {
    vi.unstubAllGlobals();
    installReducedMotionPreference(true);

    const { container } = render(<AnimatedRole role={rotatingRole} />);

    expect(container.querySelector(".profile-role")).toHaveAttribute("data-mode", "static");
    expect(container.querySelector(".profile-role__static")).toHaveTextContent("Software Engineer");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops an active flip immediately when reduced motion becomes preferred", () => {
    const setReducedMotion = installReducedMotionPreference(false);
    const { container } = render(<AnimatedRole role={rotatingRole} />);
    const root = container.querySelector(".profile-role");

    advance(animatedRoleHoldMs);
    expect(root).toHaveAttribute("data-phase", "transition");
    expect(vi.getTimerCount()).toBe(1);

    act(() => setReducedMotion(true));

    expect(root).toHaveAttribute("data-current-role", "Software Engineer");
    expect(root).toHaveAttribute("data-mode", "static");
    expect(root).toHaveAttribute("data-motion-enabled", "false");
    expect(container.querySelector(".profile-role__static")).toHaveTextContent("Software Engineer");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its pending timer when unmounted", () => {
    const { unmount } = render(<AnimatedRole role={rotatingRole} />);

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    advance(animatedRoleHoldMs + animatedRoleTransitionMs);
    expect(vi.getTimerCount()).toBe(0);
  });
});
