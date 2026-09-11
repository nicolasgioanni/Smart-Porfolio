import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, reducedMotionMediaQuery } from "@/lib/theme/themeTransition";

type ViewTransitionCallback = () => void;

function installViewTransition(
  callback: (update: ViewTransitionCallback) => unknown = vi.fn((update: ViewTransitionCallback) => {
    update();
    return { finished: Promise.resolve() };
  })
) {
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: callback
  });

  return callback;
}

function setMotionPreference(reducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === reducedMotionMediaQuery && reducedMotion,
      media: query
    }))
  });
}

describe("theme transition", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "navy";
    setMotionPreference(false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "startViewTransition");
    delete document.documentElement.dataset.theme;
  });

  it("uses one native view-transition callback for an eligible hydrated palette change", () => {
    const startViewTransition = installViewTransition();

    expect(applyTheme("dark", { animate: true }).animated).toBe(true);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("keeps initial hydration and already-selected palettes immediate", () => {
    const startViewTransition = installViewTransition();

    expect(applyTheme("light", { animate: false }).animated).toBe(false);
    expect(applyTheme("light", { animate: true }).animated).toBe(false);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("falls back to an immediate update for reduced motion, hidden documents, unsupported APIs, and API failures", () => {
    const startViewTransition = installViewTransition();
    setMotionPreference(true);
    expect(applyTheme("light", { animate: true }).animated).toBe(false);
    expect(startViewTransition).not.toHaveBeenCalled();

    setMotionPreference(false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    expect(applyTheme("dark", { animate: true }).animated).toBe(false);
    expect(startViewTransition).not.toHaveBeenCalled();

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    Reflect.deleteProperty(document, "startViewTransition");
    expect(applyTheme("navy", { animate: true }).animated).toBe(false);

    const failingTransition = installViewTransition(vi.fn(() => {
      throw new Error("View transitions unavailable");
    }));
    expect(applyTheme("light", { animate: true }).animated).toBe(false);
    expect(failingTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("does not expose a lifecycle handle when a nonstandard API omits finished", () => {
    const startViewTransition = installViewTransition(vi.fn((update: ViewTransitionCallback) => update()));

    expect(applyTheme("dark", { animate: true })).toEqual({ animated: false });
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("handles an interrupted native lifecycle without changing the final palette", async () => {
    const finished = Promise.reject(new Error("Interrupted by a newer palette"));
    installViewTransition(
      vi.fn((update: ViewTransitionCallback) => {
        update();
        return { finished };
      })
    );

    const transition = applyTheme("dark", { animate: true });

    expect(transition.animated).toBe(true);
    await expect(transition.finished).rejects.toThrow("Interrupted by a newer palette");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
