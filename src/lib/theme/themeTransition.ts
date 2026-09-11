import type { ThemeName } from "@/lib/theme/resolveThemeName";

export const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => unknown;
};

type ApplyThemeOptions = {
  animate: boolean;
};

type NativeViewTransition = {
  finished: Promise<unknown>;
};

export type ThemeTransition = {
  animated: boolean;
  finished?: Promise<unknown>;
};

function prefersReducedMotion() {
  try {
    return window.matchMedia?.(reducedMotionMediaQuery).matches ?? false;
  } catch {
    return false;
  }
}

function hasFinishedPromise(value: unknown): value is NativeViewTransition {
  return (
    typeof value === "object" &&
    value !== null &&
    "finished" in value &&
    typeof value.finished === "object" &&
    value.finished !== null &&
    "then" in value.finished &&
    typeof value.finished.then === "function"
  );
}

/**
 * Applies the effective palette at the one document-theme write boundary.
 *
 * The initial theme must remain an immediate write: the head script has already
 * selected it before paint. Hydrated updates progressively enhance to one
 * native view-transition snapshot fade when the document is visible and motion
 * is allowed.
 */
export function applyTheme(theme: ThemeName, { animate }: ApplyThemeOptions): ThemeTransition {
  const root = document.documentElement;
  const updateTheme = () => {
    root.dataset.theme = theme;
  };

  const startViewTransition = (document as ViewTransitionDocument).startViewTransition;
  const canAnimate =
    animate &&
    root.dataset.theme !== theme &&
    document.visibilityState === "visible" &&
    !prefersReducedMotion() &&
    typeof startViewTransition === "function";

  if (!canAnimate) {
    updateTheme();
    return { animated: false };
  }

  try {
    const transition = startViewTransition.call(document, updateTheme);

    if (!hasFinishedPromise(transition)) {
      return { animated: false };
    }

    // System and storage updates do not have a consumer for the lifecycle.
    // Mark rejection handled while still exposing the original promise to the
    // theme chooser when it needs to coordinate pointer leave behavior.
    void transition.finished.catch(() => {});
    return { animated: true, finished: transition.finished };
  } catch {
    updateTheme();
    return { animated: false };
  }
}
