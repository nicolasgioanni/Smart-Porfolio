"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";
import { isNavigationItemActive, type NavigationItem } from "@/components/navigation/navigationItems";
import { MOBILE_UI_QUERY, useMediaQuery } from "@/components/responsive/useMediaQuery";

export const MOBILE_NAVIGATION_IDLE_DELAY_MS = 3000;
export const MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS = 5000;
export const MOBILE_NAVIGATION_RETURN_DURATION_MS = 420;
export const MOBILE_NAVIGATION_DRIFT_PX_PER_SECOND = 20;

const EDGE_EPSILON_PX = 1;

type MobileNavigationProps = {
  actions?: ReactNode;
  externalPaused?: boolean;
  items: NavigationItem[];
};

type RailEdge = "both" | "end" | "none" | "start";

type RailMeasurement = {
  edge: RailEdge;
  maxScrollLeft: number;
  overflows: boolean;
};

type AutomationController = {
  handleScroll: () => void;
  pauseForInteraction: () => void;
  setExternalPaused: (paused: boolean) => void;
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

export function MobileNavigation({
  actions,
  externalPaused = false,
  items
}: MobileNavigationProps) {
  const pathname = usePathname();
  const mobileUiMode = useMediaQuery(MOBILE_UI_QUERY);
  const prefersReducedMotion = useReducedMotionPreference();
  const railRef = useRef<HTMLDivElement>(null);
  const automationControllerRef = useRef<AutomationController | null>(null);
  const externalPausedRef = useRef(externalPaused);
  const pendingCenteredScrollRef = useRef<number | null>(null);
  const edgeRef = useRef<RailEdge>("none");
  const overflowsRef = useRef(false);
  const [edge, setEdge] = useState<RailEdge>("none");
  const [overflows, setOverflows] = useState(false);

  externalPausedRef.current = externalPaused;

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

  const pauseForInteraction = useCallback(() => {
    automationControllerRef.current?.pauseForInteraction();
  }, []);

  const handleRailScroll = useCallback(() => {
    updateRailState();

    const rail = railRef.current;
    const pendingCenteredScroll = pendingCenteredScrollRef.current;
    if (
      rail
      && pendingCenteredScroll !== null
      && Math.abs(rail.scrollLeft - pendingCenteredScroll) <= EDGE_EPSILON_PX
    ) {
      pendingCenteredScrollRef.current = null;
      return;
    }

    pendingCenteredScrollRef.current = null;
    automationControllerRef.current?.handleScroll();
  }, [updateRailState]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail || !mobileUiMode) return;

    const previousScrollLeft = rail.scrollLeft;
    centerActiveRoute(rail);
    pendingCenteredScrollRef.current =
      Math.abs(rail.scrollLeft - previousScrollLeft) > EDGE_EPSILON_PX
        ? rail.scrollLeft
        : null;
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
    let countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let countdownRemainingMs = MOBILE_NAVIGATION_IDLE_DELAY_MS;
    let countdownStartedAt = 0;
    let externallyPaused = externalPausedRef.current;
    let phase: "drift" | "external-hold" | "idle" | "interaction-wait" | "return" | "stopped" = externallyPaused
      ? "external-hold"
      : "idle";
    let returnElapsedMs = 0;
    let returnLastTimestamp = 0;
    let returnStartScrollLeft = 0;
    let driftDirection: -1 | 1 = 1;
    let driftLastTimestamp = 0;
    let driftPosition = 0;
    let lastAutomatedScrollPosition: number | null = null;

    const setPhase = (nextPhase: typeof phase) => {
      phase = nextPhase;
      rail.toggleAttribute(
        "data-automating",
        nextPhase === "return" || nextPhase === "drift"
      );
    };

    setPhase(phase);

    const writeAutomatedScrollPosition = (position: number) => {
      rail.scrollLeft = position;
      lastAutomatedScrollPosition = rail.scrollLeft;
    };

    const cancelFrame = () => {
      if (animationFrameId === null) return;
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    };

    const cancelCountdown = (preserveRemainingTime: boolean) => {
      if (countdownTimeoutId === null) return;

      if (preserveRemainingTime) {
        countdownRemainingMs = Math.max(
          0,
          countdownRemainingMs - (performance.now() - countdownStartedAt)
        );
      }

      clearTimeout(countdownTimeoutId);
      countdownTimeoutId = null;
    };

    const cancelScheduledWork = (preserveCountdown = false) => {
      cancelCountdown(preserveCountdown);
      cancelFrame();
      rail.removeAttribute("data-automating");
    };

    const isDocumentHidden = () => document.visibilityState === "hidden";

    const getAutomationMeasurement = (): RailMeasurement | null => {
      const measurement = updateRailState();
      if (
        !mobileUiMode
        || prefersReducedMotion
        || externallyPaused
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
      writeAutomatedScrollPosition(next.position);
      updateRailState();
      scheduleAnimationFrame(runDriftFrame);
    };

    const beginDrift = (resetDirection: boolean) => {
      if (!getAutomationMeasurement()) return;

      setPhase("drift");
      if (resetDirection) driftDirection = 1;
      driftLastTimestamp = performance.now();
      driftPosition = rail.scrollLeft;
      scheduleAnimationFrame(runDriftFrame);
    };

    const runReturnFrame = (timestamp: number) => {
      if (phase !== "return" || !getAutomationMeasurement()) return;

      returnElapsedMs += Math.max(0, timestamp - returnLastTimestamp);
      returnLastTimestamp = timestamp;
      const progress = Math.min(1, returnElapsedMs / MOBILE_NAVIGATION_RETURN_DURATION_MS);
      writeAutomatedScrollPosition(
        returnStartScrollLeft * (1 - easeInOutCubic(progress))
      );
      updateRailState();

      if (progress >= 1) {
        writeAutomatedScrollPosition(0);
        updateRailState();
        beginDrift(true);
        return;
      }

      scheduleAnimationFrame(runReturnFrame);
    };

    const beginReturn = () => {
      countdownTimeoutId = null;
      if (!getAutomationMeasurement()) return;

      setPhase("return");
      returnElapsedMs = 0;
      returnLastTimestamp = performance.now();
      returnStartScrollLeft = rail.scrollLeft;

      if (returnStartScrollLeft <= EDGE_EPSILON_PX) {
        writeAutomatedScrollPosition(0);
        updateRailState();
        beginDrift(true);
        return;
      }

      scheduleAnimationFrame(runReturnFrame);
    };

    const resumeDrift = () => {
      countdownTimeoutId = null;
      beginDrift(false);
    };

    const scheduleCountdown = () => {
      if (
        (phase !== "idle" && phase !== "interaction-wait")
        || countdownTimeoutId !== null
        || !getAutomationMeasurement()
      ) return;

      countdownStartedAt = performance.now();
      countdownTimeoutId = setTimeout(
        phase === "idle" ? beginReturn : resumeDrift,
        countdownRemainingMs
      );
    };

    const pauseForInteraction = () => {
      if (prefersReducedMotion) return;

      cancelScheduledWork();
      driftPosition = rail.scrollLeft;
      lastAutomatedScrollPosition = null;
      countdownRemainingMs = MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS;

      if (externallyPaused) {
        setPhase("external-hold");
        return;
      }

      setPhase("interaction-wait");
      scheduleCountdown();
    };

    const handleScroll = () => {
      if (
        lastAutomatedScrollPosition !== null
        && Math.abs(rail.scrollLeft - lastAutomatedScrollPosition) <= EDGE_EPSILON_PX
      ) {
        lastAutomatedScrollPosition = null;
        return;
      }

      pauseForInteraction();
    };

    const setExternalPaused = (paused: boolean) => {
      if (paused === externallyPaused) return;

      externallyPaused = paused;
      cancelScheduledWork();
      driftPosition = rail.scrollLeft;
      lastAutomatedScrollPosition = null;

      if (paused) {
        setPhase("external-hold");
        return;
      }

      countdownRemainingMs = MOBILE_NAVIGATION_INTERACTION_RESUME_DELAY_MS;
      setPhase("interaction-wait");
      scheduleCountdown();
    };

    const stopAutomation = () => {
      setPhase("stopped");
      cancelScheduledWork();
    };

    const handleVisibilityChange = () => {
      if (isDocumentHidden()) {
        cancelScheduledWork(phase === "idle" || phase === "interaction-wait");
        return;
      }

      if (phase === "idle" || phase === "interaction-wait") {
        scheduleCountdown();
      } else if (phase === "return" && getAutomationMeasurement()) {
        rail.setAttribute("data-automating", "");
        returnLastTimestamp = performance.now();
        scheduleAnimationFrame(runReturnFrame);
      } else if (phase === "drift" && getAutomationMeasurement()) {
        rail.setAttribute("data-automating", "");
        driftLastTimestamp = performance.now();
        scheduleAnimationFrame(runDriftFrame);
      }
    };

    const handleResize = () => {
      const measurement = updateRailState();

      if (!measurement?.overflows) {
        cancelScheduledWork(phase === "idle" || phase === "interaction-wait");
        return;
      }

      driftPosition = Math.min(measurement.maxScrollLeft, Math.max(0, driftPosition));

      if (phase === "idle" || phase === "interaction-wait") {
        scheduleCountdown();
      } else if (phase === "return" && animationFrameId === null && getAutomationMeasurement()) {
        rail.setAttribute("data-automating", "");
        returnLastTimestamp = performance.now();
        scheduleAnimationFrame(runReturnFrame);
      } else if (phase === "drift" && animationFrameId === null && getAutomationMeasurement()) {
        rail.setAttribute("data-automating", "");
        driftLastTimestamp = performance.now();
        scheduleAnimationFrame(runDriftFrame);
      }
    };

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(handleResize);

    resizeObserver?.observe(rail);
    rail
      .querySelectorAll<HTMLElement>(
        ".mobile-navigation__routes, .mobile-navigation__link, .blob-header__actions"
      )
      .forEach((element) => {
        resizeObserver?.observe(element);
      });
    if (!prefersReducedMotion) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    automationControllerRef.current = {
      handleScroll,
      pauseForInteraction,
      setExternalPaused,
      stop: stopAutomation
    };
    updateRailState();
    scheduleCountdown();

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

  useEffect(() => {
    automationControllerRef.current?.setExternalPaused(externalPaused);
  }, [externalPaused]);

  return (
    <div
      className="mobile-navigation mobile-navigation__rail"
      data-edge={edge}
      data-overflow={overflows ? "true" : "false"}
      onFocusCapture={pauseForInteraction}
      onKeyDown={pauseForInteraction}
      onPointerDown={pauseForInteraction}
      onScroll={handleRailScroll}
      onTouchStart={pauseForInteraction}
      onWheel={pauseForInteraction}
      ref={railRef}
    >
      <nav
        aria-label="Mobile navigation"
        className="mobile-navigation__routes"
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
      {actions}
    </div>
  );
}
