"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";
import { isNavigationItemActive, type NavigationItem } from "@/components/navigation/navigationItems";
import { MOBILE_UI_QUERY, useMediaQuery } from "@/components/responsive/useMediaQuery";

export const MOBILE_NAVIGATION_IDLE_DELAY_MS = 3000;
export const MOBILE_NAVIGATION_RETURN_DURATION_MS = 420;
export const MOBILE_NAVIGATION_DRIFT_PX_PER_SECOND = 20;

const EDGE_EPSILON_PX = 1;

type MobileNavigationProps = {
  items: NavigationItem[];
};

type RailEdge = "both" | "end" | "none" | "start";

type RailMeasurement = {
  edge: RailEdge;
  maxScrollLeft: number;
  overflows: boolean;
};

type AutomationController = {
  stop: () => void;
};

function measureRail(rail: HTMLElement): RailMeasurement {
  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
  const overflows = maxScrollLeft > EDGE_EPSILON_PX;

  if (!overflows) return { edge: "none", maxScrollLeft, overflows };

  const hasHiddenStart = rail.scrollLeft > EDGE_EPSILON_PX;
  const hasHiddenEnd = rail.scrollLeft < maxScrollLeft - EDGE_EPSILON_PX;

  if (hasHiddenStart && hasHiddenEnd) return { edge: "both", maxScrollLeft, overflows };
  if (hasHiddenStart) return { edge: "start", maxScrollLeft, overflows };
  if (hasHiddenEnd) return { edge: "end", maxScrollLeft, overflows };
  return { edge: "none", maxScrollLeft, overflows };
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function centerActiveRoute(rail: HTMLElement): void {
  const activeLink = rail.querySelector<HTMLElement>('[aria-current="page"]');
  if (!activeLink) return;

  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
  if (maxScrollLeft <= EDGE_EPSILON_PX) {
    rail.scrollLeft = 0;
    return;
  }

  const railRect = rail.getBoundingClientRect();
  const activeLinkRect = activeLink.getBoundingClientRect();
  const activeLinkCenter = activeLinkRect.left - railRect.left + rail.scrollLeft + activeLinkRect.width / 2;
  const centeredScrollLeft = activeLinkCenter - rail.clientWidth / 2;

  rail.scrollLeft = Math.min(maxScrollLeft, Math.max(0, centeredScrollLeft));
}

function getReflectedScrollPosition(
  currentPosition: number,
  direction: -1 | 1,
  distance: number,
  maxScrollLeft: number
): { direction: -1 | 1; position: number } {
  if (maxScrollLeft <= EDGE_EPSILON_PX) return { direction: 1, position: 0 };

  let nextDirection = direction;
  let nextPosition = currentPosition + direction * distance;

  while (nextPosition < 0 || nextPosition > maxScrollLeft) {
    if (nextPosition > maxScrollLeft) {
      nextPosition = maxScrollLeft - (nextPosition - maxScrollLeft);
      nextDirection = -1;
    } else {
      nextPosition = -nextPosition;
      nextDirection = 1;
    }
  }

  return { direction: nextDirection, position: nextPosition };
}

export function MobileNavigation({ items }: MobileNavigationProps) {
  const pathname = usePathname();
  const mobileUiMode = useMediaQuery(MOBILE_UI_QUERY);
  const prefersReducedMotion = useReducedMotionPreference();
  const railRef = useRef<HTMLElement>(null);
  const automationControllerRef = useRef<AutomationController | null>(null);
  const interactionLockedRef = useRef(false);
  const edgeRef = useRef<RailEdge>("none");
  const overflowsRef = useRef(false);
  const [edge, setEdge] = useState<RailEdge>("none");
  const [overflows, setOverflows] = useState(false);

  const updateRailState = useCallback((): RailMeasurement | null => {
    const rail = railRef.current;
    if (!rail) return null;

    const measurement = measureRail(rail);
    if (edgeRef.current !== measurement.edge) {
      edgeRef.current = measurement.edge;
      setEdge(measurement.edge);
    }
    if (overflowsRef.current !== measurement.overflows) {
      overflowsRef.current = measurement.overflows;
      setOverflows(measurement.overflows);
    }
    return measurement;
  }, []);

  const lockAutomation = useCallback(() => {
    interactionLockedRef.current = true;
    automationControllerRef.current?.stop();
  }, []);

  useEffect(() => {
    interactionLockedRef.current = false;
  }, [pathname]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    centerActiveRoute(rail);
    updateRailState();
  }, [mobileUiMode, pathname, updateRailState]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (!mobileUiMode) {
      rail.removeAttribute("data-automating");
      return;
    }

    let animationFrameId: number | null = null;
    let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleRemainingMs = MOBILE_NAVIGATION_IDLE_DELAY_MS;
    let idleStartedAt = 0;
    let phase: "drift" | "idle" | "return" | "stopped" = "idle";
    let returnElapsedMs = 0;
    let returnLastTimestamp = 0;
    let returnStartScrollLeft = 0;
    let driftDirection: -1 | 1 = 1;
    let driftLastTimestamp = 0;
    let driftPosition = 0;

    const setPhase = (nextPhase: typeof phase) => {
      phase = nextPhase;
      rail.toggleAttribute(
        "data-automating",
        nextPhase === "return" || nextPhase === "drift"
      );
    };

    setPhase("idle");

    const cancelFrame = () => {
      if (animationFrameId === null) return;
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    };

    const cancelIdleTimeout = (preserveRemainingTime: boolean) => {
      if (idleTimeoutId === null) return;

      if (preserveRemainingTime) {
        idleRemainingMs = Math.max(0, idleRemainingMs - (performance.now() - idleStartedAt));
      }

      clearTimeout(idleTimeoutId);
      idleTimeoutId = null;
    };

    const cancelScheduledWork = (preserveIdleTime = false) => {
      cancelIdleTimeout(preserveIdleTime);
      cancelFrame();
    };

    const isDocumentHidden = () => document.visibilityState === "hidden";

    const getAutomationMeasurement = (): RailMeasurement | null => {
      const measurement = updateRailState();
      if (
        !mobileUiMode
        || prefersReducedMotion
        || interactionLockedRef.current
        || isDocumentHidden()
        || !measurement?.overflows
      ) return null;

      return measurement;
    };

    const scheduleAnimationFrame = (callback: FrameRequestCallback) => {
      cancelFrame();
      animationFrameId = window.requestAnimationFrame((timestamp) => {
        animationFrameId = null;
        callback(timestamp);
      });
    };

    const runDriftFrame = (timestamp: number) => {
      if (phase !== "drift") return;

      const measurement = getAutomationMeasurement();
      if (!measurement) return;
      const elapsedSeconds = Math.max(0, timestamp - driftLastTimestamp) / 1000;
      const next = getReflectedScrollPosition(
        driftPosition,
        driftDirection,
        MOBILE_NAVIGATION_DRIFT_PX_PER_SECOND * elapsedSeconds,
        measurement.maxScrollLeft
      );

      driftDirection = next.direction;
      driftLastTimestamp = timestamp;
      driftPosition = next.position;
      rail.scrollLeft = next.position;
      updateRailState();
      scheduleAnimationFrame(runDriftFrame);
    };

    const beginDrift = () => {
      if (!getAutomationMeasurement()) return;

      setPhase("drift");
      driftDirection = 1;
      driftLastTimestamp = performance.now();
      driftPosition = rail.scrollLeft;
      scheduleAnimationFrame(runDriftFrame);
    };

    const runReturnFrame = (timestamp: number) => {
      if (phase !== "return" || !getAutomationMeasurement()) return;

      returnElapsedMs += Math.max(0, timestamp - returnLastTimestamp);
      returnLastTimestamp = timestamp;
      const progress = Math.min(1, returnElapsedMs / MOBILE_NAVIGATION_RETURN_DURATION_MS);
      rail.scrollLeft = returnStartScrollLeft * (1 - easeInOutCubic(progress));
      updateRailState();

      if (progress >= 1) {
        rail.scrollLeft = 0;
        updateRailState();
        beginDrift();
        return;
      }

      scheduleAnimationFrame(runReturnFrame);
    };

    const beginReturn = () => {
      idleTimeoutId = null;
      if (!getAutomationMeasurement()) return;

      setPhase("return");
      returnElapsedMs = 0;
      returnLastTimestamp = performance.now();
      returnStartScrollLeft = rail.scrollLeft;

      if (returnStartScrollLeft <= EDGE_EPSILON_PX) {
        rail.scrollLeft = 0;
        updateRailState();
        beginDrift();
        return;
      }

      scheduleAnimationFrame(runReturnFrame);
    };

    const scheduleIdleTimeout = () => {
      if (phase !== "idle" || idleTimeoutId !== null || !getAutomationMeasurement()) return;

      idleStartedAt = performance.now();
      idleTimeoutId = setTimeout(beginReturn, idleRemainingMs);
    };

    const stopAutomation = () => {
      setPhase("stopped");
      cancelScheduledWork();
    };

    const handleVisibilityChange = () => {
      if (isDocumentHidden()) {
        cancelScheduledWork(phase === "idle");
        return;
      }

      if (phase === "idle") {
        scheduleIdleTimeout();
      } else if (phase === "return" && getAutomationMeasurement()) {
        returnLastTimestamp = performance.now();
        scheduleAnimationFrame(runReturnFrame);
      } else if (phase === "drift" && getAutomationMeasurement()) {
        driftLastTimestamp = performance.now();
        scheduleAnimationFrame(runDriftFrame);
      }
    };

    const handleResize = () => {
      const measurement = updateRailState();

      if (!measurement?.overflows) {
        cancelScheduledWork();
        if (phase !== "stopped") {
          setPhase("idle");
          idleRemainingMs = MOBILE_NAVIGATION_IDLE_DELAY_MS;
        }
        return;
      }

      if (phase === "idle") scheduleIdleTimeout();
    };

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(handleResize);

    resizeObserver?.observe(rail);
    rail.querySelectorAll<HTMLElement>(".mobile-navigation__link").forEach((link) => {
      resizeObserver?.observe(link);
    });
    if (!prefersReducedMotion) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    automationControllerRef.current = { stop: stopAutomation };
    updateRailState();
    scheduleIdleTimeout();

    return () => {
      stopAutomation();
      resizeObserver?.disconnect();
      if (!prefersReducedMotion) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (automationControllerRef.current?.stop === stopAutomation) {
        automationControllerRef.current = null;
      }
    };
  }, [mobileUiMode, pathname, prefersReducedMotion, updateRailState]);

  return (
    <div className="mobile-navigation">
      <nav
        aria-label="Mobile navigation"
        className="mobile-navigation__rail"
        data-edge={edge}
        data-overflow={overflows ? "true" : "false"}
        onFocusCapture={lockAutomation}
        onKeyDown={lockAutomation}
        onPointerDown={lockAutomation}
        onScroll={updateRailState}
        onWheel={lockAutomation}
        ref={railRef}
      >
        {items.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className="mobile-navigation__link hover-base-1 hover-base-1--compact"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
