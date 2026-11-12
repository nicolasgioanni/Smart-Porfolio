"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";

type ContactStep = 1 | 2 | 3;
type ContactView = "verification" | "form";

type UseContactStepTransitionOptions = {
  active: boolean;
  onStepChange: (step: ContactStep) => void;
  step: ContactStep;
  view: ContactView;
};

const stepTransitionDurationMs = 280;
const stepTransitionEasing = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Animates the live contact step's measured container without retaining a
 * second copy of form controls. The Turnstile gate stays outside this frame.
 */
export function useContactStepTransition({ active, onStepChange, step, view }: UseContactStepTransitionOptions) {
  const frameRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | undefined>(undefined);
  const pendingHeightRef = useRef<number | undefined>(undefined);
  const prefersReducedMotion = useReducedMotionPreference();

  const releaseFrame = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.height = "";
    frame.style.overflow = "";
    frame.style.overflowClipMargin = "";
  }, []);

  const cancelAnimation = useCallback(() => {
    animationRef.current?.cancel();
    animationRef.current = undefined;
    releaseFrame();
  }, [releaseFrame]);

  const transitionToStep = useCallback(
    (nextStep: ContactStep) => {
      if (nextStep === step) return;

      const currentHeight = frameRef.current?.getBoundingClientRect().height;
      cancelAnimation();
      pendingHeightRef.current =
        active && view === "form" && currentHeight && Number.isFinite(currentHeight) ? currentHeight : undefined;
      onStepChange(nextStep);
    },
    [active, cancelAnimation, onStepChange, step, view]
  );

  useLayoutEffect(() => {
    const startHeight = pendingHeightRef.current;
    pendingHeightRef.current = undefined;

    if (startHeight === undefined) {
      if (prefersReducedMotion || !active || view !== "form") cancelAnimation();
      return;
    }

    const frame = frameRef.current;
    const stepContent = frame?.querySelector<HTMLElement>(".contact-step");
    if (!frame || !stepContent) return;

    const targetHeight = stepContent.getBoundingClientRect().height;
    const browserRequestsReducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionAllowed =
      !prefersReducedMotion && !browserRequestsReducedMotion && !document.hidden && typeof frame.animate === "function";

    if (!motionAllowed || !Number.isFinite(targetHeight) || Math.abs(targetHeight - startHeight) < 1) {
      releaseFrame();
      return;
    }

    frame.style.height = `${startHeight}px`;
    const supportsClip = typeof CSS !== "undefined" && CSS.supports("overflow", "clip");
    frame.style.overflow = supportsClip ? "clip" : "hidden";
    if (supportsClip) frame.style.overflowClipMargin = "4px";

    try {
      const animation = frame.animate(
        [{ height: `${startHeight}px` }, { height: `${targetHeight}px` }],
        { duration: stepTransitionDurationMs, easing: stepTransitionEasing, fill: "forwards" }
      );
      animationRef.current = animation;

      const finish = () => {
        if (animationRef.current !== animation) return;
        animationRef.current = undefined;
        animation.cancel();
        releaseFrame();
      };
      const cancelCurrentAnimation = () => {
        if (animationRef.current === animation) cancelAnimation();
      };
      const cancelForViewportChange = () => cancelCurrentAnimation();
      const cancelForHiddenDocument = () => {
        if (document.hidden) cancelCurrentAnimation();
      };
      const cancelForClippedFocus = (event: FocusEvent) => {
        const target = event.target instanceof HTMLElement ? event.target : undefined;
        if (!target) return;

        const frameBox = frame.getBoundingClientRect();
        const targetBox = target.getBoundingClientRect();
        if (targetBox.top < frameBox.top || targetBox.bottom > frameBox.bottom) cancelCurrentAnimation();
      };
      const resizeObserver =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(([entry]) => {
              if (Math.abs(entry.contentRect.height - targetHeight) >= 1) cancelCurrentAnimation();
            })
          : undefined;

      window.addEventListener("resize", cancelForViewportChange, { once: true });
      document.addEventListener("visibilitychange", cancelForHiddenDocument);
      frame.addEventListener("focusin", cancelForClippedFocus);
      resizeObserver?.observe(stepContent);
      void animation.finished
        .then(finish, finish)
        .finally(() => {
          window.removeEventListener("resize", cancelForViewportChange);
          document.removeEventListener("visibilitychange", cancelForHiddenDocument);
          frame.removeEventListener("focusin", cancelForClippedFocus);
          resizeObserver?.disconnect();
        });
    } catch {
      cancelAnimation();
    }
  }, [active, cancelAnimation, prefersReducedMotion, releaseFrame, step, view]);

  useEffect(() => () => cancelAnimation(), [cancelAnimation]);

  return {
    frameRef,
    transitionToStep
  };
}
