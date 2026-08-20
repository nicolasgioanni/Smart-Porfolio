"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

const routeIndicatorDurationMs = 420;
const routeIndicatorEasing = "cubic-bezier(0.65, 0, 0.35, 1)";
// The header geometry morph lasts 460ms. Keep the route transition alive for
// one additional frame so resize observations can retarget without snapping.
const routeGeometrySettleDurationMs = 480;
const geometryTolerance = 0.5;

type IndicatorGeometry = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type AlignOptions = {
  animate: boolean;
  durationMs?: number;
};

type RouteTransition = {
  id: number;
  settleAt: number;
};

type UseActiveRouteIndicatorOptions = {
  activeHref?: string;
  pathname: string;
};

function geometriesMatch(first: IndicatorGeometry | null, second: IndicatorGeometry): boolean {
  if (!first) return false;

  return (
    Math.abs(first.x - second.x) <= geometryTolerance &&
    Math.abs(first.y - second.y) <= geometryTolerance &&
    Math.abs(first.width - second.width) <= geometryTolerance &&
    Math.abs(first.height - second.height) <= geometryTolerance
  );
}

function measureTarget(navigation: HTMLElement, target: HTMLElement): IndicatorGeometry {
  const navigationRect = navigation.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  return {
    height: targetRect.height,
    width: targetRect.width,
    x: targetRect.left - navigationRect.left - navigation.clientLeft,
    y: targetRect.top - navigationRect.top - navigation.clientTop
  };
}

function geometryTransform({ x, y }: IndicatorGeometry): string {
  return `translate3d(${x}px, ${y}px, 0)`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function getCurrentTime(): number {
  return window.performance?.now() ?? Date.now();
}

export function useActiveRouteIndicator({ activeHref, pathname }: UseActiveRouteIndicatorOptions) {
  const navigationRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const activeHrefRef = useRef(activeHref);
  const committedActiveHrefRef = useRef(activeHref);
  const animationRef = useRef<Animation | null>(null);
  const geometryRef = useRef<IndicatorGeometry | null>(null);
  const initializedRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const rafRef = useRef<number | null>(null);
  const routeSettleTimerRef = useRef<number | null>(null);
  const routeTransitionIdRef = useRef(0);
  const routeTransitionRef = useRef<RouteTransition | null>(null);
  const alignRef = useRef<(options: AlignOptions) => void>(() => undefined);

  activeHrefRef.current = activeHref;

  const cancelAnimation = useCallback(() => {
    const animation = animationRef.current;
    animationRef.current = null;
    animation?.cancel();
  }, []);

  const clearRouteTransition = useCallback(() => {
    routeTransitionRef.current = null;

    if (routeSettleTimerRef.current !== null) {
      window.clearTimeout(routeSettleTimerRef.current);
      routeSettleTimerRef.current = null;
    }
  }, []);

  const beginRouteTransition = useCallback(() => {
    clearRouteTransition();

    const transitionId = routeTransitionIdRef.current + 1;
    routeTransitionIdRef.current = transitionId;
    routeTransitionRef.current = {
      id: transitionId,
      settleAt: getCurrentTime() + routeGeometrySettleDurationMs
    };
    routeSettleTimerRef.current = window.setTimeout(() => {
      if (routeTransitionRef.current?.id !== transitionId) return;

      routeTransitionRef.current = null;
      routeSettleTimerRef.current = null;
      alignRef.current({ animate: false });
    }, routeGeometrySettleDurationMs);
  }, [clearRouteTransition]);

  const getRemainingRouteDuration = useCallback((): number => {
    const transition = routeTransitionRef.current;
    if (!transition) return 0;

    const remainingDuration = Math.ceil(transition.settleAt - getCurrentTime());
    return Math.max(0, Math.min(routeIndicatorDurationMs, remainingDuration));
  }, []);

  alignRef.current = ({ animate, durationMs = routeIndicatorDurationMs }) => {
    const navigation = navigationRef.current;
    const indicator = indicatorRef.current;

    if (!navigation || !indicator) return;

    const target = activeHrefRef.current
      ? navigation.querySelector<HTMLElement>('[data-route-active="true"]')
      : null;

    navigation.dataset.routeIndicatorReady = "true";

    if (!target) {
      cancelAnimation();
      geometryRef.current = null;
      indicator.dataset.visible = "false";
      return;
    }

    const nextGeometry = measureTarget(navigation, target);

    indicator.dataset.visible = "true";

    if (geometriesMatch(geometryRef.current, nextGeometry)) return;

    const wasVisible = geometryRef.current !== null;
    const previousRect = animate && wasVisible ? indicator.getBoundingClientRect() : null;

    cancelAnimation();

    indicator.style.height = `${nextGeometry.height}px`;
    indicator.style.width = `${nextGeometry.width}px`;
    indicator.style.transform = geometryTransform(nextGeometry);
    geometryRef.current = nextGeometry;

    const canAnimate =
      animate &&
      previousRect !== null &&
      previousRect.width > 0 &&
      previousRect.height > 0 &&
      nextGeometry.width > 0 &&
      nextGeometry.height > 0 &&
      durationMs > 0 &&
      !prefersReducedMotion() &&
      typeof indicator.animate === "function";

    if (!canAnimate) return;

    const navigationRect = navigation.getBoundingClientRect();
    const previousGeometry: IndicatorGeometry = {
      height: previousRect.height,
      width: previousRect.width,
      x: previousRect.left - navigationRect.left - navigation.clientLeft,
      y: previousRect.top - navigationRect.top - navigation.clientTop
    };
    const startTransform = `${geometryTransform(previousGeometry)} scale(${previousGeometry.width / nextGeometry.width}, ${
      previousGeometry.height / nextGeometry.height
    })`;
    let animation: Animation;

    try {
      animation = indicator.animate(
        [
          { opacity: 0.82, transform: startTransform },
          { opacity: 1, transform: geometryTransform(nextGeometry) }
        ],
        {
          duration: durationMs,
          easing: routeIndicatorEasing,
          fill: "none"
        }
      );
    } catch {
      // The final geometry is already applied, so a partial Web Animations
      // implementation can safely fall back to the snapped state.
      return;
    }

    animationRef.current = animation;
    animation.onfinish = () => {
      if (animationRef.current === animation) animationRef.current = null;
    };
    animation.oncancel = () => {
      if (animationRef.current === animation) animationRef.current = null;
    };
  };

  useLayoutEffect(() => {
    const pathnameChanged = initializedRef.current && pathnameRef.current !== pathname;
    const activeHrefChanged = initializedRef.current && committedActiveHrefRef.current !== activeHref;
    const indicator = indicatorRef.current;
    const animateRouteChange =
      pathnameChanged &&
      activeHrefChanged &&
      Boolean(activeHref) &&
      geometryRef.current !== null &&
      !prefersReducedMotion() &&
      typeof indicator?.animate === "function";

    if (animateRouteChange) {
      beginRouteTransition();
    } else {
      clearRouteTransition();
    }

    pathnameRef.current = pathname;
    committedActiveHrefRef.current = activeHref;
    alignRef.current({
      animate: animateRouteChange,
      durationMs: animateRouteChange ? getRemainingRouteDuration() : undefined
    });
    initializedRef.current = true;
  }, [activeHref, beginRouteTransition, clearRouteTransition, getRemainingRouteDuration, pathname]);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    let active = true;

    function alignAfterGeometryChange() {
      rafRef.current = null;
      if (!active) return;

      const remainingRouteDuration = getRemainingRouteDuration();
      alignRef.current({
        animate: remainingRouteDuration > 0,
        durationMs: remainingRouteDuration || undefined
      });
    }

    function scheduleAlignment() {
      if (!active || rafRef.current !== null) return;

      if (typeof window.requestAnimationFrame === "function") {
        rafRef.current = window.requestAnimationFrame(alignAfterGeometryChange);
      } else {
        alignAfterGeometryChange();
      }
    }

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            scheduleAlignment();
          })
        : null;

    resizeObserver?.observe(navigation);
    navigation.querySelectorAll<HTMLElement>("[data-navigation-link]").forEach((link) => resizeObserver?.observe(link));
    window.addEventListener("resize", scheduleAlignment, { passive: true });

    const fonts = document.fonts;
    if (fonts) {
      void fonts.ready.then(scheduleAlignment).catch(() => undefined);
      fonts.addEventListener?.("loadingdone", scheduleAlignment);
    }

    return () => {
      active = false;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleAlignment);
      fonts?.removeEventListener?.("loadingdone", scheduleAlignment);

      if (rafRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = null;
      clearRouteTransition();
      cancelAnimation();
    };
  }, [cancelAnimation, clearRouteTransition, getRemainingRouteDuration]);

  return { indicatorRef, navigationRef };
}
