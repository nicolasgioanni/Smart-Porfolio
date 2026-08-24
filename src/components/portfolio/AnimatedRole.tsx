"use client";

import { useEffect, useState } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";
import type { ProfileOverviewRole } from "@/content/types";

export const animatedRoleHoldMs = 3400;
export const animatedRoleTransitionMs = 640;
export const animatedRoleVerticalOffsetPx = 8;
export const animatedRoleFlipDegrees = 70;
export const animatedRoleEasing = "cubic-bezier(0.22, 1, 0.36, 1)";

type RoleTransitionMode = "line" | "prefix";

type RoleRotationState =
  | {
      currentIndex: number;
      phase: "idle";
    }
  | {
      currentIndex: number;
      nextIndex: number;
      phase: "transition";
      transitionMode: RoleTransitionMode;
    };

type LayerState = "active" | "inactive" | "incoming" | "outgoing";

const initialRotationState: RoleRotationState = {
  currentIndex: 0,
  phase: "idle"
};

function joinRole(prefix: string, suffix: string): string {
  return [prefix, suffix].filter(Boolean).join(" ");
}

function getFirstRoleLabel(role: ProfileOverviewRole): string {
  if (role.kind === "static") return role.label;

  const firstEngineerRole = joinRole(role.engineerPrefixes[0] ?? "", role.engineerSuffix);
  return firstEngineerRole || role.alternate;
}

function getRoleLabel(role: Extract<ProfileOverviewRole, { kind: "rotating" }>, index: number): string {
  if (index >= role.engineerPrefixes.length) return role.alternate;
  return joinRole(role.engineerPrefixes[index] ?? "", role.engineerSuffix);
}

function getEngineerLineState(state: RoleRotationState, prefixCount: number): LayerState {
  if (state.phase === "idle") {
    return state.currentIndex < prefixCount ? "active" : "inactive";
  }

  if (state.transitionMode === "prefix") return "active";
  return state.currentIndex < prefixCount ? "outgoing" : "incoming";
}

function getAlternateState(state: RoleRotationState, prefixCount: number): LayerState {
  if (state.phase === "idle") {
    return state.currentIndex === prefixCount ? "active" : "inactive";
  }

  if (state.transitionMode === "prefix") return "inactive";
  return state.currentIndex === prefixCount ? "outgoing" : "incoming";
}

function getActiveEngineerPrefixIndex(state: RoleRotationState, prefixCount: number): number {
  if (state.phase === "transition" && state.transitionMode === "line") {
    return state.currentIndex < prefixCount ? state.currentIndex : state.nextIndex;
  }

  return state.currentIndex < prefixCount ? state.currentIndex : 0;
}

function getPrefixState(
  prefixIndex: number,
  state: RoleRotationState,
  prefixCount: number
): LayerState {
  if (state.phase === "transition" && state.transitionMode === "prefix") {
    if (prefixIndex === state.currentIndex) return "outgoing";
    if (prefixIndex === state.nextIndex) return "incoming";
    return "inactive";
  }

  return prefixIndex === getActiveEngineerPrefixIndex(state, prefixCount) ? "active" : "inactive";
}

type AnimatedRoleProps = {
  motionEnabled?: boolean;
  role: ProfileOverviewRole;
};

export function AnimatedRole({ motionEnabled = true, role }: AnimatedRoleProps) {
  const prefersReducedMotion = useReducedMotionPreference();
  const [rotationState, setRotationState] = useState<RoleRotationState>(initialRotationState);
  const firstRoleLabel = getFirstRoleLabel(role);
  const prefixCount = role.kind === "rotating" ? role.engineerPrefixes.length : 0;
  const hasCompleteRotation =
    role.kind === "rotating" &&
    prefixCount > 0 &&
    Boolean(role.engineerSuffix) &&
    Boolean(role.alternate);
  const shouldAnimate = hasCompleteRotation && motionEnabled && !prefersReducedMotion;

  useEffect(() => {
    if (!shouldAnimate) {
      setRotationState(initialRotationState);
      return;
    }

    // The shared preference hook updates after hydration. This synchronous check
    // prevents even a short-lived timer when the initial media query already matches.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    if (rotationState.phase === "idle") {
      const holdTimer = window.setTimeout(() => {
        const nextIndex = (rotationState.currentIndex + 1) % (prefixCount + 1);
        const transitionMode: RoleTransitionMode =
          rotationState.currentIndex < prefixCount && nextIndex < prefixCount ? "prefix" : "line";

        setRotationState({
          currentIndex: rotationState.currentIndex,
          nextIndex,
          phase: "transition",
          transitionMode
        });
      }, animatedRoleHoldMs);

      return () => window.clearTimeout(holdTimer);
    }

    const transitionTimer = window.setTimeout(() => {
      setRotationState({
        currentIndex: rotationState.nextIndex,
        phase: "idle"
      });
    }, animatedRoleTransitionMs);

    return () => window.clearTimeout(transitionTimer);
  }, [prefixCount, rotationState, shouldAnimate]);

  const renderStaticRole = role.kind === "static" || !shouldAnimate;
  const currentRoleLabel =
    role.kind === "rotating" && !renderStaticRole
      ? getRoleLabel(role, rotationState.currentIndex)
      : firstRoleLabel;
  const nextRoleLabel =
    role.kind === "rotating" && !renderStaticRole && rotationState.phase === "transition"
      ? getRoleLabel(role, rotationState.nextIndex)
      : undefined;
  const mode = renderStaticRole
    ? "static"
    : rotationState.phase === "transition"
      ? rotationState.transitionMode
      : rotationState.currentIndex === prefixCount
        ? "alternate"
        : "prefix";

  return (
    <div
      className="profile-role"
      data-current-role={currentRoleLabel}
      data-easing={animatedRoleEasing}
      data-flip-degrees={animatedRoleFlipDegrees}
      data-hold-ms={animatedRoleHoldMs}
      data-mode={mode}
      data-motion-enabled={shouldAnimate ? "true" : "false"}
      data-next-role={nextRoleLabel}
      data-offset-px={animatedRoleVerticalOffsetPx}
      data-phase={renderStaticRole ? "static" : rotationState.phase}
      data-transition-ms={animatedRoleTransitionMs}
    >
      <span className="profile-role__accessible visually-hidden">{firstRoleLabel}</span>
      <span aria-hidden="true" className="profile-role__window">
        {role.kind === "rotating" ? (
          <span className="profile-role__sizer">
            {[...role.engineerPrefixes.map((prefix) => joinRole(prefix, role.engineerSuffix)), role.alternate].map(
              (label, index) => (
                <span className="profile-role__sizer-label" key={`${label}-${index}`}>
                  {label}
                </span>
              )
            )}
          </span>
        ) : (
          <span className="profile-role__sizer">
            <span className="profile-role__sizer-label">{role.label}</span>
          </span>
        )}

        {renderStaticRole ? (
          <span className="profile-role__static" data-state="active">
            {firstRoleLabel}
          </span>
        ) : role.kind === "rotating" ? (
          <>
            <span
              className="profile-role__engineer-line"
              data-state={getEngineerLineState(rotationState, prefixCount)}
            >
              <span className="profile-role__prefix-window">
                {role.engineerPrefixes.map((prefix, prefixIndex) => (
                  <span
                    className="profile-role__prefix"
                    data-prefix-index={prefixIndex}
                    data-state={getPrefixState(prefixIndex, rotationState, prefixCount)}
                    key={`${prefix}-${prefixIndex}`}
                  >
                    {prefix}
                  </span>
                ))}
              </span>
              <span className="profile-role__suffix">{role.engineerSuffix}</span>
            </span>
            <span className="profile-role__alternate" data-state={getAlternateState(rotationState, prefixCount)}>
              {role.alternate}
            </span>
          </>
        ) : null}
      </span>
    </div>
  );
}
