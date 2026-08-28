import { readFileSync } from "node:fs";
import path from "node:path";
import { act, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnimatedRole,
  animatedRoleEasing,
  animatedRoleFlipDegrees,
  animatedRoleHoldMs,
  animatedRoleMobileStageMs,
  animatedRoleTransitionMs,
  animatedRoleVerticalOffsetPx
} from "@/components/portfolio/AnimatedRole";
import { MOBILE_UI_QUERY } from "@/components/responsive/useMediaQuery";
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

const portfolioStyles = readFileSync(path.join(process.cwd(), "src", "styles", "portfolio.css"), "utf8");

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function installMediaPreferences({
  mobileUi = false,
  reducedMotion = false
}: {
  mobileUi?: boolean;
  reducedMotion?: boolean;
} = {}) {
  const matchesByQuery = new Map<string, boolean>([
    [MOBILE_UI_QUERY, mobileUi],
    [reducedMotionQuery, reducedMotion]
  ]);
  const listenersByQuery = new Map<string, Set<(event: MediaQueryListEvent) => void>>();
  const mediaQueries = new Map<string, MediaQueryList>();

  const matchMedia = vi.fn((query: string) => {
    const existingMediaQuery = mediaQueries.get(query);
    if (existingMediaQuery) return existingMediaQuery;

    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    listenersByQuery.set(query, listeners);
    const mediaQuery = {
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
      dispatchEvent: vi.fn(),
      get matches() {
        return matchesByQuery.get(query) ?? false;
      },
      media: query,
      onchange: null,
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
      removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener))
    } as unknown as MediaQueryList;
    mediaQueries.set(query, mediaQuery);
    return mediaQuery;
  });

  vi.stubGlobal("matchMedia", matchMedia);

  const setPreference = (query: string, matches: boolean) => {
    matchesByQuery.set(query, matches);
    const event = { matches, media: query } as MediaQueryListEvent;
    listenersByQuery.get(query)?.forEach((listener) => listener(event));
  };

  return {
    setMobileUi: (matches: boolean) => setPreference(MOBILE_UI_QUERY, matches),
    setReducedMotion: (matches: boolean) => setPreference(reducedMotionQuery, matches)
  };
}

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

describe("AnimatedRole", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMediaPreferences();
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

  it("keeps desktop 3D role styling while the mobile label uses an opacity-only presentation", () => {
    const mobileUiStyles = portfolioStyles.match(
      /@media \(max-width: 980px\)\s*\{[\s\S]*?(?=@media \(max-width: 720px\))/
    )?.[0] ?? "";
    const mobileWindowRule =
      mobileUiStyles.match(/\.profile-role__mobile-window\s*\{[^}]*}/s)?.[0] ?? "";
    const mobileLabelRule =
      mobileUiStyles.match(/\.profile-role__mobile-label\s*\{[^}]*}/s)?.[0] ?? "";

    expect(portfolioStyles).toMatch(
      /\.profile-role__window\s*\{[^}]*-webkit-mask-image:[^}]*mask-image:[^}]*perspective:\s*700px/s
    );
    expect(portfolioStyles).toMatch(
      /\.profile-role__prefix,\s*\.profile-role__engineer-line,\s*\.profile-role__alternate\s*\{[^}]*backface-visibility:\s*hidden;[^}]*transform-style:\s*preserve-3d/s
    );
    expect(mobileUiStyles).toMatch(/\.profile-role__window\s*\{[^}]*display:\s*none/);
    expect(mobileWindowRule).toMatch(/overflow:\s*visible/);
    expect(mobileWindowRule).toMatch(/-webkit-mask-image:\s*none/);
    expect(mobileWindowRule).toMatch(/mask-image:\s*none/);
    expect(mobileWindowRule).toMatch(/perspective:\s*none/);
    expect(mobileLabelRule).toMatch(/transition:\s*opacity 320ms var\(--profile-role-easing\)/);
    expect(mobileLabelRule).toMatch(/transform:\s*none/);
    expect(mobileLabelRule).toMatch(/will-change:\s*auto/);
    expect(mobileLabelRule).not.toMatch(
      /rotateX|perspective|mask-image|backface-visibility|transform-style|filter|text-shadow/
    );
    expect(portfolioStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.profile-role__mobile-label\s*\{[^}]*transition:\s*none/
    );
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

  it("selects the single-label renderer in mobile UI mode", () => {
    vi.unstubAllGlobals();
    installMediaPreferences({ mobileUi: true });

    const { container } = render(<AnimatedRole role={rotatingRole} />);
    const root = container.querySelector(".profile-role");
    const mobileLabels = container.querySelectorAll(".profile-role__mobile-label");

    expect(root).toHaveAttribute("data-responsive-mode", "mobile-ui");
    expect(root).toHaveAttribute("data-mode", "mobile");
    expect(mobileLabels).toHaveLength(1);
    expect(mobileLabels[0]).toHaveTextContent("Software Engineer");
    expect(mobileLabels[0]).toHaveAttribute("data-state", "active");
    expect(container.querySelector(".profile-role__mobile-window")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".profile-role__accessible")).toHaveLength(1);
    expect(container.querySelector("[aria-live]")).not.toBeInTheDocument();
  });

  it("swaps the one mobile label only while it is faded out", () => {
    vi.unstubAllGlobals();
    installMediaPreferences({ mobileUi: true });

    const { container } = render(<AnimatedRole role={rotatingRole} />);
    const root = container.querySelector(".profile-role");
    const mobileLabel = container.querySelector(".profile-role__mobile-label");

    expect(animatedRoleMobileStageMs).toBe(320);
    advance(animatedRoleHoldMs);

    expect(root).toHaveAttribute("data-current-role", "Software Engineer");
    expect(root).toHaveAttribute("data-next-role", "AI Engineer");
    expect(root).toHaveAttribute("data-phase", "transition");
    expect(mobileLabel).toHaveTextContent("Software Engineer");
    expect(mobileLabel).toHaveAttribute("data-state", "outgoing");
    expect(container.querySelectorAll(".profile-role__mobile-label")).toHaveLength(1);

    advance(animatedRoleMobileStageMs - 1);
    expect(mobileLabel).toHaveTextContent("Software Engineer");
    expect(mobileLabel).toHaveAttribute("data-state", "outgoing");

    advance(1);
    expect(container.querySelector(".profile-role__mobile-label")).toBe(mobileLabel);
    expect(mobileLabel).toHaveTextContent("AI Engineer");
    expect(mobileLabel).toHaveAttribute("data-state", "incoming");
    expect(root).toHaveAttribute("data-current-role", "AI Engineer");
    expect(root).not.toHaveAttribute("data-next-role");

    advance(animatedRoleTransitionMs - animatedRoleMobileStageMs - 1);
    expect(root).toHaveAttribute("data-phase", "transition");
    advance(1);
    expect(root).toHaveAttribute("data-phase", "idle");
    expect(mobileLabel).toHaveAttribute("data-state", "active");
    expect(container.querySelectorAll(".profile-role__mobile-label")).toHaveLength(1);
  });

  it("rotates mobile labels through the configured order and loops", () => {
    vi.unstubAllGlobals();
    installMediaPreferences({ mobileUi: true });

    const { container } = render(<AnimatedRole role={rotatingRole} />);
    const root = container.querySelector(".profile-role");
    const expectedLabels = ["AI Engineer", "Security Engineer", "Research Scientist", "Software Engineer"];

    expectedLabels.forEach((expectedLabel) => {
      advance(animatedRoleHoldMs);
      advance(animatedRoleMobileStageMs);
      advance(animatedRoleTransitionMs - animatedRoleMobileStageMs);

      expect(root).toHaveAttribute("data-current-role", expectedLabel);
      expect(container.querySelector(".profile-role__mobile-label")).toHaveTextContent(expectedLabel);
      expect(container.querySelectorAll(".profile-role__mobile-label")).toHaveLength(1);
    });
  });

  it("settles to one valid label when the responsive mode changes mid-transition", () => {
    vi.unstubAllGlobals();
    const { setMobileUi } = installMediaPreferences({ mobileUi: true });
    const { container } = render(<AnimatedRole role={rotatingRole} />);
    const root = container.querySelector(".profile-role");

    advance(animatedRoleHoldMs);
    expect(container.querySelector(".profile-role__mobile-label")).toHaveAttribute(
      "data-state",
      "outgoing"
    );
    expect(vi.getTimerCount()).toBe(1);

    act(() => setMobileUi(false));

    expect(root).toHaveAttribute("data-responsive-mode", "desktop");
    expect(root).toHaveAttribute("data-current-role", "Software Engineer");
    expect(root).toHaveAttribute("data-phase", "idle");
    expect(root).toHaveAttribute("data-mode", "prefix");
    expect(container.querySelector(".profile-role__engineer-line")).toHaveAttribute("data-state", "active");
    expect(container.querySelector(".profile-role__mobile-label")).toHaveAttribute("data-state", "active");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("resets mobile rotation and its timer when the role configuration changes", () => {
    vi.unstubAllGlobals();
    installMediaPreferences({ mobileUi: true });
    const { container, rerender } = render(<AnimatedRole role={rotatingRole} />);

    advance(animatedRoleHoldMs);
    expect(container.querySelector(".profile-role__mobile-label")).toHaveAttribute(
      "data-state",
      "outgoing"
    );

    const updatedRole: ProfileOverviewRole = {
      alternate: "Applied Researcher",
      engineerPrefixes: ["Data", "Platform"],
      engineerSuffix: "Engineer",
      kind: "rotating"
    };
    rerender(<AnimatedRole role={updatedRole} />);

    expect(container.querySelector(".profile-role")).toHaveAttribute("data-current-role", "Data Engineer");
    expect(container.querySelector(".profile-role")).toHaveAttribute("data-phase", "idle");
    expect(container.querySelector(".profile-role__mobile-label")).toHaveTextContent("Data Engineer");
    expect(container.querySelector(".profile-role__mobile-label")).toHaveAttribute("data-state", "active");
    expect(container.querySelector(".profile-role__accessible")).toHaveTextContent("Data Engineer");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("clears a pending mobile transition timer when unmounted", () => {
    vi.unstubAllGlobals();
    installMediaPreferences({ mobileUi: true });
    const { container, unmount } = render(<AnimatedRole role={rotatingRole} />);

    advance(animatedRoleHoldMs);
    expect(container.querySelector(".profile-role__mobile-label")).toHaveAttribute(
      "data-state",
      "outgoing"
    );
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(animatedRoleTransitionMs);
    expect(vi.getTimerCount()).toBe(0);
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
    installMediaPreferences({ mobileUi: true, reducedMotion: true });

    const { container } = render(<AnimatedRole role={rotatingRole} />);

    expect(container.querySelector(".profile-role")).toHaveAttribute("data-mode", "static");
    expect(container.querySelector(".profile-role")).toHaveAttribute("data-responsive-mode", "mobile-ui");
    expect(container.querySelector(".profile-role__static")).toHaveTextContent("Software Engineer");
    expect(container.querySelector(".profile-role__mobile-label")).toHaveAttribute("data-state", "static");
    expect(container.querySelector(".profile-role__mobile-label")).toHaveTextContent("Software Engineer");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops an active flip immediately when reduced motion becomes preferred", () => {
    const { setReducedMotion } = installMediaPreferences();
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
