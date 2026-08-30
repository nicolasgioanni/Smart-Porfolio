"use client";

import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GlassIconButton } from "@/components/glass/GlassIconButton";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { useThemePreference } from "@/components/theme/useThemePreference";
import type { ThemeName } from "@/lib/theme/resolveThemeName";
import { themeLabels, themePreferenceOptions } from "@/lib/theme/themeOptions";
import { systemThemePreference } from "@/lib/theme/themePreference";

export const themeMenuCloseDelayMs = 240;
export const themeMenuPortalViewportGutterPx = 12;

type ThemeSwitcherProps = {
  initialTheme: ThemeName;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  portalPopover?: boolean;
};

type PortalPlacement = {
  bottom: number;
  right: number;
};

export function ThemeSwitcher({
  initialTheme,
  onOpenChange,
  open: controlledOpen,
  portalPopover = false
}: ThemeSwitcherProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [portalPlacement, setPortalPlacement] = useState<PortalPlacement | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const finePointerRef = useRef(true);
  const themeTransitionIdRef = useRef(0);
  const ignoreThemeTransitionLeaveRef = useRef(false);
  const open = controlledOpen ?? internalOpen;
  const openRef = useRef(open);
  const popoverRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { selectedPreference, selectedTheme, updateThemePreference } = useThemePreference(initialTheme);
  openRef.current = open;

  const updatePortalPlacement = useCallback(() => {
    if (!portalPopover) return;

    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const nextPlacement = {
      bottom: Math.max(0, Math.round(window.innerHeight - triggerRect.top)),
      right: Math.max(
        themeMenuPortalViewportGutterPx,
        Math.round(window.innerWidth - triggerRect.right)
      )
    };

    setPortalPlacement((currentPlacement) => {
      if (
        currentPlacement?.bottom === nextPlacement.bottom &&
        currentPlacement.right === nextPlacement.right
      ) {
        return currentPlacement;
      }

      return nextPlacement;
    });
  }, [portalPopover]);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current === undefined) return;

    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  }, []);

  const requestOpenChange = useCallback(
    (nextOpen: boolean) => {
      cancelScheduledClose();
      if (openRef.current === nextOpen) return;

      if (nextOpen) {
        updatePortalPlacement();
      }

      openRef.current = nextOpen;
      if (controlledOpen === undefined) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [cancelScheduledClose, controlledOpen, onOpenChange, updatePortalPlacement]
  );

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = undefined;
      requestOpenChange(false);
    }, themeMenuCloseDelayMs);
  }, [cancelScheduledClose, requestOpenChange]);

  useEffect(() => {
    if (portalPopover) {
      setPortalReady(true);
    }
  }, [portalPopover]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(hover: hover) and (pointer: fine)");

    function updatePointerMode() {
      finePointerRef.current = mediaQuery ? mediaQuery.matches : true;
    }

    updatePointerMode();
    mediaQuery?.addEventListener?.("change", updatePointerMode);
    mediaQuery?.addListener?.(updatePointerMode);

    return () => {
      mediaQuery?.removeEventListener?.("change", updatePointerMode);
      mediaQuery?.removeListener?.(updatePointerMode);
    };
  }, []);

  useEffect(() => {
    if (!open || !portalPopover || !portalReady) return;

    updatePortalPlacement();
    window.addEventListener("resize", updatePortalPlacement);
    document.addEventListener("scroll", updatePortalPlacement, true);

    return () => {
      window.removeEventListener("resize", updatePortalPlacement);
      document.removeEventListener("scroll", updatePortalPlacement, true);
    };
  }, [open, portalPopover, portalReady, updatePortalPlacement]);

  useEffect(() => {
    if (!open) return;

    function handleOutsidePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        (rootRef.current?.contains(event.target) || popoverRef.current?.contains(event.target))
      ) {
        return;
      }
      requestOpenChange(false);
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
  }, [open, requestOpenChange]);

  useEffect(
    () => () => {
      cancelScheduledClose();
    },
    [cancelScheduledClose]
  );

  function handlePointerEnter() {
    cancelScheduledClose();
    if (finePointerRef.current) {
      requestOpenChange(true);
    }
  }

  function handlePointerLeave() {
    if (ignoreThemeTransitionLeaveRef.current) {
      ignoreThemeTransitionLeaveRef.current = false;
      cancelScheduledClose();
      return;
    }

    if (finePointerRef.current) {
      scheduleClose();
    }
  }

  function handleFocusCapture() {
    cancelScheduledClose();
    requestOpenChange(true);
  }

  function handleBlurCapture(event: ReactFocusEvent<HTMLDivElement>) {
    if (
      event.relatedTarget instanceof Node &&
      (rootRef.current?.contains(event.relatedTarget) ||
        popoverRef.current?.contains(event.relatedTarget))
    ) {
      return;
    }
    scheduleClose();
  }

  function handleTriggerClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (finePointerRef.current && event.detail > 0) {
      requestOpenChange(true);
      return;
    }

    requestOpenChange(!openRef.current);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !openRef.current) return;

    event.preventDefault();
    triggerRef.current?.focus();
    requestOpenChange(false);
  }

  function preservePointerFocus(event: ReactPointerEvent<HTMLButtonElement>) {
    if (finePointerRef.current) {
      event.preventDefault();
    }
  }

  function selectThemePreference(
    preference: (typeof themePreferenceOptions)[number]["name"],
    event: ReactMouseEvent<HTMLButtonElement>
  ) {
    const transition = updateThemePreference(preference);
    const transitionId = themeTransitionIdRef.current + 1;
    themeTransitionIdRef.current = transitionId;
    ignoreThemeTransitionLeaveRef.current = transition.animated && finePointerRef.current && event.detail > 0;

    if (!transition.finished) return;

    void transition.finished.then(
      () => {
        if (themeTransitionIdRef.current === transitionId) {
          ignoreThemeTransitionLeaveRef.current = false;
        }
      },
      () => {
        if (themeTransitionIdRef.current === transitionId) {
          ignoreThemeTransitionLeaveRef.current = false;
        }
      }
    );
  }

  const isPortaled = portalPopover && portalReady;
  const portalStyle: CSSProperties | undefined = isPortaled
    ? {
        bottom: portalPlacement === null ? 0 : `${portalPlacement.bottom}px`,
        left: "auto",
        position: "fixed",
        right:
          portalPlacement === null
            ? `${themeMenuPortalViewportGutterPx}px`
            : `${portalPlacement.right}px`,
        top: "auto",
        visibility: portalPlacement === null ? "hidden" : undefined
      }
    : undefined;
  const popover = (
    <div
      aria-hidden={!open}
      className={`theme-switcher__popover${isPortaled ? " theme-switcher__popover--portal" : ""}`}
      data-state={open ? "open" : "closed"}
      id={panelId}
      onBlurCapture={isPortaled ? handleBlurCapture : undefined}
      onFocusCapture={isPortaled ? handleFocusCapture : undefined}
      onKeyDown={isPortaled ? handleKeyDown : undefined}
      onPointerEnter={isPortaled ? handlePointerEnter : undefined}
      onPointerLeave={isPortaled ? handlePointerLeave : undefined}
      ref={popoverRef}
      style={portalStyle}
    >
      <div aria-label="Color theme preference" className="theme-switcher__panel" role="group">
        {themePreferenceOptions.map(({ label, name }) => (
          <button
            aria-label={
              name === systemThemePreference
                ? selectedPreference === systemThemePreference
                  ? `System, follows device setting; currently ${themeLabels[selectedTheme]}`
                  : "System, follows device setting"
                : undefined
            }
            aria-pressed={selectedPreference === name}
            className="theme-switcher__option hover-base-1 hover-base-1--compact hover-base-1--inline"
            key={name}
            onClick={(event) => selectThemePreference(name, event)}
            onPointerDown={preservePointerFocus}
            tabIndex={open ? 0 : -1}
            type="button"
          >
            <span>{label}</span>
            {name === systemThemePreference ? (
              <span aria-hidden="true" className="theme-switcher__option-detail">
                Auto
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div
        className="theme-switcher"
        data-open={open ? "true" : "false"}
        onBlurCapture={handleBlurCapture}
        onFocusCapture={handleFocusCapture}
        onKeyDown={handleKeyDown}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        ref={rootRef}
      >
        <GlassIconButton
          aria-controls={panelId}
          aria-expanded={open}
          className="theme-switcher__trigger"
          label={
            selectedPreference === systemThemePreference
              ? `Choose color theme. Current setting: System; using ${themeLabels[selectedTheme]}`
              : `Choose color theme. Current setting: ${themeLabels[selectedTheme]}`
          }
          onClick={handleTriggerClick}
          ref={triggerRef}
        >
          <ThemeIcon />
        </GlassIconButton>

        {isPortaled ? null : popover}
      </div>

      {isPortaled ? createPortal(popover, document.body) : null}
    </>
  );
}
