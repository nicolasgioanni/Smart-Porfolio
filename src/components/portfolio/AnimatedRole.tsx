"use client";

import { useEffect, useState } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";
import { MOBILE_UI_QUERY, useMediaQuery } from "@/components/responsive/useMediaQuery";
import type { ProfileOverviewRole } from "@/content/types";

export const animatedRoleHoldMs = 3400;
export const animatedRoleTransitionMs = 640;
export const animatedRoleMobileStageMs = animatedRoleTransitionMs / 2;
export const animatedRoleVerticalOffsetPx = 8;
export const animatedRoleFlipDegrees = 70;
export const animatedRoleEasing = "cubic-bezier(0.22, 1, 0.36, 1)";

type ResponsivePresentation = "desktop" | "mobile";
type RoleTransitionMode = "line" | "prefix";

type RoleRotationState =
  | {
      configurationKey: string;
      currentIndex: number;
      phase: "idle";
    }
  | {
      configurationKey: string;
      currentIndex: number;
      nextIndex: number;
      phase: "transition";
      presentation: "desktop";
      transitionMode: RoleTransitionMode;
    }
  | {
      configurationKey: string;
      currentIndex: number;
      mobileStage: "outgoing";
      nextIndex: number;
      phase: "transition";
      presentation: "mobile";
    }
  | {
      configurationKey: string;
      currentIndex: number;
      mobileStage: "incoming";
      phase: "transition";
      presentation: "mobile";
    };

type LayerState = "active" | "inactive" | "incoming" | "outgoing";

function createIdleRotationState(configurationKey: string, currentIndex = 0): RoleRotationState {
  return {
    configurationKey,
    currentIndex,
    phase: "idle"
  };
}

function joinRole(prefix: string, suffix: string): string {
  return [prefix, suffix].filter(Boolean).join(" ");
}

function getFirstRoleLabel(role: ProfileOverviewRole): string {
  if (role.kind === "static") return role.label;

  const firstEngineerRole = joinRole(role.engineerPrefixes[0] ?? "", role.engineerSuffix);
  return firstEngineerRole || role.alternate;
}

function getRoleConfigurationKey(role: ProfileOverviewRole): string {
  if (role.kind === "static") return JSON.stringify([role.kind, role.label]);
  return JSON.stringify([role.kind, role.engineerPrefixes, role.engineerSuffix, role.alternate]);
}

function getRoleLabel(role: Extract<ProfileOverviewRole, { kind: "rotating" }>, index: number): string {
  if (index >= role.engineerPrefixes.length) return role.alternate;
  return joinRole(role.engineerPrefixes[index] ?? "", role.engineerSuffix);
}

function settleForPresentation(
  state: RoleRotationState,
  presentation: ResponsivePresentation
): RoleRotationState {
  if (state.phase === "transition" && state.presentation !== presentation) {
    return createIdleRotationState(state.configurationKey, state.currentIndex);
  }

  return state;
}

function getEngineerLineState(state: RoleRotationState, prefixCount: number): LayerState {
  if (state.phase === "idle" || state.presentation === "mobile") {
    return state.currentIndex < prefixCount ? "active" : "inactive";
  }

  if (state.transitionMode === "prefix") return "active";
  return state.currentIndex < prefixCount ? "outgoing" : "incoming";
}

function getAlternateState(state: RoleRotationState, prefixCount: number): LayerState {
  if (state.phase === "idle" || state.presentation === "mobile") {
    return state.currentIndex === prefixCount ? "active" : "inactive";
  }

  if (state.transitionMode === "prefix") return "inactive";
  return state.currentIndex === prefixCount ? "outgoing" : "incoming";
}

function getActiveEngineerPrefixIndex(state: RoleRotationState, prefixCount: number): number {
  if (
    state.phase === "transition" &&
    state.presentation === "desktop" &&
    state.transitionMode === "line"
  ) {
    return state.currentIndex < prefixCount ? state.currentIndex : state.nextIndex;
  }

  return state.currentIndex < prefixCount ? state.currentIndex : 0;
}

function getPrefixState(
  prefixIndex: number,
  state: RoleRotationState,
  prefixCount: number
): LayerState {
  if (
    state.phase === "transition" &&
    state.presentation === "desktop" &&
    state.transitionMode === "prefix"
  ) {
    if (prefixIndex === state.currentIndex) return "outgoing";
    if (prefixIndex === state.nextIndex) return "incoming";
    return "inactive";
  }

  return prefixIndex === getActiveEngineerPrefixIndex(state, prefixCount) ? "active" : "inactive";
}

function getMobileLabelState(state: RoleRotationState): "active" | "incoming" | "outgoing" {
  if (state.phase === "transition" && state.presentation === "mobile") return state.mobileStage;
  return "active";
}

type AnimatedRoleProps = {
  motionEnabled?: boolean;
  role: ProfileOverviewRole;
};

export function AnimatedRole({ motionEnabled = true, role }: AnimatedRoleProps) {
  const prefersReducedMotion = useReducedMotionPreference();
  const usesMobileUi = useMediaQuery(MOBILE_UI_QUERY);
  const roleConfigurationKey = getRoleConfigurationKey(role);
  const [rotationState, setRotationState] = useState<RoleRotationState>(() =>
    createIdleRotationState(roleConfigurationKey)
  );
  const firstRoleLabel = getFirstRoleLabel(role);
  const prefixCount = role.kind === "rotating" ? role.engineerPrefixes.length : 0;
  const hasCompleteRotation =
    role.kind === "rotating" &&
    prefixCount > 0 &&
    Boolean(role.engineerSuffix) &&
    Boolean(role.alternate);
  const shouldAnimate = hasCompleteRotation && motionEnabled && !prefersReducedMotion;
  const presentation: ResponsivePresentation = usesMobileUi ? "mobile" : "desktop";

  useEffect(() => {
    if (!shouldAnimate) {
      setRotationState((currentState) =>
        currentState.configurationKey === roleConfigurationKey &&
        currentState.phase === "idle" &&
        currentState.currentIndex === 0
          ? currentState
          : createIdleRotationState(roleConfigurationKey)
      );
      return;
    }

    // The shared preference hook updates after hydration. This synchronous check
    // prevents even a short-lived timer when the initial media query already matches.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setRotationState(createIdleRotationState(roleConfigurationKey));
      return;
    }

    if (rotationState.configurationKey !== roleConfigurationKey) {
      setRotationState(createIdleRotationState(roleConfigurationKey));
      return;
    }

    if (rotationState.phase === "transition" && rotationState.presentation !== presentation) {
      setRotationState(createIdleRotationState(roleConfigurationKey, rotationState.currentIndex));
      return;
    }

    if (rotationState.phase === "idle") {
      const holdTimer = window.setTimeout(() => {
        const nextIndex = (rotationState.currentIndex + 1) % (prefixCount + 1);

        if (presentation === "mobile") {
          setRotationState({
            configurationKey: roleConfigurationKey,
            currentIndex: rotationState.currentIndex,
            mobileStage: "outgoing",
            nextIndex,
            phase: "transition",
            presentation: "mobile"
          });
          return;
        }

        const transitionMode: RoleTransitionMode =
          rotationState.currentIndex < prefixCount && nextIndex < prefixCount ? "prefix" : "line";

        setRotationState({
          configurationKey: roleConfigurationKey,
          currentIndex: rotationState.currentIndex,
          nextIndex,
          phase: "transition",
          presentation: "desktop",
          transitionMode
        });
      }, animatedRoleHoldMs);

      return () => window.clearTimeout(holdTimer);
    }

    if (rotationState.presentation === "desktop") {
      const transitionTimer = window.setTimeout(() => {
        setRotationState(createIdleRotationState(roleConfigurationKey, rotationState.nextIndex));
      }, animatedRoleTransitionMs);

      return () => window.clearTimeout(transitionTimer);
    }

    if (rotationState.mobileStage === "outgoing") {
      const exitTimer = window.setTimeout(() => {
        setRotationState({
          configurationKey: roleConfigurationKey,
          currentIndex: rotationState.nextIndex,
          mobileStage: "incoming",
          phase: "transition",
          presentation: "mobile"
        });
      }, animatedRoleMobileStageMs);

      return () => window.clearTimeout(exitTimer);
    }

    const entranceTimer = window.setTimeout(() => {
      setRotationState(createIdleRotationState(roleConfigurationKey, rotationState.currentIndex));
    }, animatedRoleTransitionMs - animatedRoleMobileStageMs);

    return () => window.clearTimeout(entranceTimer);
  }, [prefixCount, presentation, roleConfigurationKey, rotationState, shouldAnimate]);

  const renderStaticRole = role.kind === "static" || !shouldAnimate;
  const configuredRotationState =
    rotationState.configurationKey === roleConfigurationKey
      ? rotationState
      : createIdleRotationState(roleConfigurationKey);
  const presentedRotationState = settleForPresentation(configuredRotationState, presentation);
  const currentRoleLabel =
    role.kind === "rotating" && !renderStaticRole
      ? getRoleLabel(role, presentedRotationState.currentIndex)
      : firstRoleLabel;
  const nextRoleLabel =
    role.kind === "rotating" &&
    !renderStaticRole &&
    presentedRotationState.phase === "transition" &&
    (presentedRotationState.presentation === "desktop" ||
      presentedRotationState.mobileStage === "outgoing")
      ? getRoleLabel(role, presentedRotationState.nextIndex)
      : undefined;
  const mode = renderStaticRole
    ? "static"
    : presentation === "mobile"
      ? "mobile"
      : presentedRotationState.phase === "transition" &&
          presentedRotationState.presentation === "desktop"
        ? presentedRotationState.transitionMode
        : presentedRotationState.currentIndex === prefixCount
          ? "alternate"
          : "prefix";
  const roleLabels =
    role.kind === "rotating"
      ? [...role.engineerPrefixes.map((prefix) => joinRole(prefix, role.engineerSuffix)), role.alternate]
      : [role.label];

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
      data-phase={renderStaticRole ? "static" : presentedRotationState.phase}
      data-responsive-mode={presentation === "mobile" ? "mobile-ui" : "desktop"}
      data-transition-ms={animatedRoleTransitionMs}
    >
      <span className="profile-role__accessible visually-hidden">{firstRoleLabel}</span>
      <span aria-hidden="true" className="profile-role__window">
        <span className="profile-role__sizer">
          {roleLabels.map((label, index) => (
            <span className="profile-role__sizer-label" key={`${label}-${index}`}>
              {label}
            </span>
          ))}
        </span>

        {renderStaticRole ? (
          <span className="profile-role__static" data-state="active">
            {firstRoleLabel}
          </span>
        ) : role.kind === "rotating" ? (
          <>
            <span
              className="profile-role__engineer-line"
              data-state={getEngineerLineState(presentedRotationState, prefixCount)}
            >
              <span className="profile-role__prefix-window">
                {role.engineerPrefixes.map((prefix, prefixIndex) => (
                  <span
                    className="profile-role__prefix"
                    data-prefix-index={prefixIndex}
                    data-state={getPrefixState(prefixIndex, presentedRotationState, prefixCount)}
                    key={`${prefix}-${prefixIndex}`}
                  >
                    {prefix}
                  </span>
                ))}
              </span>
              <span className="profile-role__suffix">{role.engineerSuffix}</span>
            </span>
            <span
              className="profile-role__alternate"
              data-state={getAlternateState(presentedRotationState, prefixCount)}
            >
              {role.alternate}
            </span>
          </>
        ) : null}
      </span>
      <span aria-hidden="true" className="profile-role__mobile-window">
        <span className="profile-role__mobile-sizer">
          {roleLabels.map((label, index) => (
            <span className="profile-role__mobile-sizer-label" key={`${label}-${index}`}>
              {label}
            </span>
          ))}
        </span>
        <span
          className="profile-role__mobile-label"
          data-state={renderStaticRole ? "static" : getMobileLabelState(presentedRotationState)}
        >
          {currentRoleLabel}
        </span>
      </span>
    </div>
  );
}
