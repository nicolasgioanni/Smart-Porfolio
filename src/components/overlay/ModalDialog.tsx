"use client";

import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";

export const modalDialogFadeMs = 180;

type DialogState = "inactive" | "opening" | "open" | "closing";

type ModalDialogAccessibleName =
  | { ariaLabel: string; ariaLabelledBy?: never }
  | { ariaLabel?: never; ariaLabelledBy: string };

type ModalDialogProps = ModalDialogAccessibleName & {
  ariaDescribedBy?: string;
  children: ReactNode;
  dataTestId?: string;
  dialogId: string;
  frameClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onAfterClose?: () => void;
  onOpenError?: () => void;
  onRequestClose: () => void;
  open: boolean;
  presentation?: "portal" | "in-place";
  restoreFocusRef?: RefObject<HTMLElement | null>;
  rootClassName?: string;
};

const focusableElementSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])'
].join(",");

let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = "";

type ModalDialogInstanceId = symbol;

const modalDialogStack: ModalDialogInstanceId[] = [];
const modalDialogRoots = new Map<ModalDialogInstanceId, HTMLElement>();
const modalDialogStackListeners = new Set<() => void>();

function notifyModalDialogStack() {
  modalDialogStackListeners.forEach((listener) => listener());
}

function getTopmostModalDialogId(): ModalDialogInstanceId | null {
  return modalDialogStack.at(-1) ?? null;
}

function getServerTopmostModalDialogId(): ModalDialogInstanceId | null {
  return null;
}

function subscribeToModalDialogStack(listener: () => void) {
  modalDialogStackListeners.add(listener);
  return () => modalDialogStackListeners.delete(listener);
}

function promoteModalDialog(instanceId: ModalDialogInstanceId) {
  const existingIndex = modalDialogStack.lastIndexOf(instanceId);
  if (existingIndex >= 0 && existingIndex === modalDialogStack.length - 1) return;

  if (existingIndex >= 0) modalDialogStack.splice(existingIndex, 1);
  modalDialogStack.push(instanceId);
  notifyModalDialogStack();
}

function registerModalDialog(instanceId: ModalDialogInstanceId, root: HTMLElement | null) {
  if (root) modalDialogRoots.set(instanceId, root);
  promoteModalDialog(instanceId);
  let released = false;

  return () => {
    if (released) return;
    released = true;

    const existingIndex = modalDialogStack.lastIndexOf(instanceId);
    if (existingIndex < 0) return;

    modalDialogStack.splice(existingIndex, 1);
    modalDialogRoots.delete(instanceId);
    notifyModalDialogStack();
  };
}

function isTopmostModalDialog(instanceId: ModalDialogInstanceId) {
  return getTopmostModalDialogId() === instanceId;
}

function containsTopmostModalDialog(instanceId: ModalDialogInstanceId) {
  const topmostDialogId = getTopmostModalDialogId();
  if (!topmostDialogId || topmostDialogId === instanceId) return false;

  const root = modalDialogRoots.get(instanceId);
  const topmostRoot = modalDialogRoots.get(topmostDialogId);
  return Boolean(root && topmostRoot && root.contains(topmostRoot));
}

function acquireBodyScrollLock() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  bodyScrollLockCount += 1;
  let released = false;

  return () => {
    if (released) return;

    released = true;
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);

    if (bodyScrollLockCount === 0) {
      document.body.style.overflow = bodyOverflowBeforeLock;
      bodyOverflowBeforeLock = "";
    }
  };
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableElementSelector)).filter(
    (element) =>
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest('[aria-hidden="true"], [hidden], [inert]')
  );
}

function getDialogFocusScope(dialogFrame: HTMLElement): HTMLElement {
  const fullscreenElement = document.fullscreenElement;
  return fullscreenElement instanceof HTMLElement && dialogFrame.contains(fullscreenElement) ? fullscreenElement : dialogFrame;
}

export function ModalDialog({
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  children,
  dataTestId,
  dialogId,
  frameClassName,
  initialFocusRef,
  onAfterClose,
  onOpenError,
  onRequestClose,
  open,
  presentation = "portal",
  restoreFocusRef,
  rootClassName
}: ModalDialogProps) {
  const isInPlace = presentation === "in-place";
  const [dialogState, setDialogState] = useState<DialogState>(open ? "opening" : "inactive");
  const [mounted, setMounted] = useState(open || isInPlace);
  const [portalReady, setPortalReady] = useState(false);
  const dialogFrameRef = useRef<HTMLDivElement>(null);
  const dialogRootRef = useRef<HTMLElement>(null);
  const nativeDialogRef = useRef<HTMLDialogElement>(null);
  const closeRequestedRef = useRef(false);
  const failedToOpenRef = useRef(false);
  const dialogInstanceIdRef = useRef<ModalDialogInstanceId>(Symbol("modal-dialog"));
  const focusContainmentReleasedRef = useRef(false);
  const initialFocusAppliedRef = useRef(false);
  const onAfterCloseRef = useRef(onAfterClose);
  const onOpenErrorRef = useRef(onOpenError);
  const onRequestCloseRef = useRef(onRequestClose);
  const prefersReducedMotion = useReducedMotionPreference();
  const topmostDialogId = useSyncExternalStore(
    subscribeToModalDialogStack,
    getTopmostModalDialogId,
    getServerTopmostModalDialogId
  );
  const hasModalLifecycle = mounted && (!isInPlace || dialogState !== "inactive");
  const isTopmost = hasModalLifecycle && topmostDialogId === dialogInstanceIdRef.current;
  const containsTopmost = hasModalLifecycle && containsTopmostModalDialog(dialogInstanceIdRef.current);
  const isAccessible = isTopmost || containsTopmost;

  const setDialogRoot = useCallback((node: HTMLElement | null) => {
    dialogRootRef.current = node;
    if (!node) {
      modalDialogRoots.delete(dialogInstanceIdRef.current);
      return;
    }

    modalDialogRoots.set(dialogInstanceIdRef.current, node);
    notifyModalDialogStack();
  }, []);

  const setNativeDialogRoot = useCallback(
    (node: HTMLDialogElement | null) => {
      nativeDialogRef.current = node;
      setDialogRoot(node);
    },
    [setDialogRoot]
  );

  onAfterCloseRef.current = onAfterClose;
  onOpenErrorRef.current = onOpenError;
  onRequestCloseRef.current = onRequestClose;

  const requestClose = useCallback(() => {
    if (closeRequestedRef.current || !isTopmostModalDialog(dialogInstanceIdRef.current)) return;
    closeRequestedRef.current = true;
    onRequestCloseRef.current();
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!hasModalLifecycle) return;
    return registerModalDialog(dialogInstanceIdRef.current, dialogRootRef.current);
  }, [hasModalLifecycle]);

  useEffect(() => {
    if (hasModalLifecycle && open) promoteModalDialog(dialogInstanceIdRef.current);
  }, [hasModalLifecycle, open]);

  useEffect(() => {
    if (open) {
      if (failedToOpenRef.current) return;
      closeRequestedRef.current = false;
      focusContainmentReleasedRef.current = false;
      setMounted(true);
      setDialogState("opening");

      const openTimeout = window.setTimeout(() => setDialogState("open"), 0);
      return () => window.clearTimeout(openTimeout);
    }

    failedToOpenRef.current = false;
    if (!hasModalLifecycle) return;

    setDialogState("closing");
    const closeTimeout = window.setTimeout(
      () => {
        const restoreTarget = restoreFocusRef?.current;
        const nativeDialog = nativeDialogRef.current;

        focusContainmentReleasedRef.current = true;
        if (nativeDialog?.open) nativeDialog.close();
        setMounted(isInPlace);
        setDialogState(isInPlace ? "inactive" : "opening");
        onAfterCloseRef.current?.();

        if (isTopmostModalDialog(dialogInstanceIdRef.current) && restoreTarget?.isConnected) {
          restoreTarget.focus();
        }
      },
      prefersReducedMotion ? 0 : modalDialogFadeMs
    );

    return () => window.clearTimeout(closeTimeout);
  }, [hasModalLifecycle, isInPlace, open, prefersReducedMotion, restoreFocusRef]);

  useEffect(() => {
    if (!hasModalLifecycle) return;
    return acquireBodyScrollLock();
  }, [hasModalLifecycle]);

  useEffect(() => {
    if (!isInPlace) return;

    return () => {
      const nativeDialog = nativeDialogRef.current;
      if (nativeDialog?.open) nativeDialog.close();
    };
  }, [isInPlace]);

  useEffect(() => {
    if (!isInPlace || !open || !mounted || dialogState === "inactive" || failedToOpenRef.current) return;

    const nativeDialog = nativeDialogRef.current;
    if (!nativeDialog || nativeDialog.open) return;

    try {
      nativeDialog.showModal();
    } catch {
      if (nativeDialog.open) nativeDialog.close();
      failedToOpenRef.current = true;
      focusContainmentReleasedRef.current = true;
      setDialogState("inactive");
      onOpenErrorRef.current?.();
    }
  }, [dialogState, isInPlace, mounted, open]);

  useEffect(() => {
    if (!open) {
      initialFocusAppliedRef.current = false;
      return;
    }

    if (!hasModalLifecycle || !isTopmost || initialFocusAppliedRef.current) return;

    initialFocusAppliedRef.current = true;
    const focusTimeout = window.setTimeout(() => {
      (initialFocusRef?.current ?? dialogFrameRef.current)?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimeout);
  }, [hasModalLifecycle, initialFocusRef, isTopmost, open]);

  useEffect(() => {
    if (!hasModalLifecycle || !isTopmost) return;

    function focusFirstDialogControl() {
      const dialogFrame = dialogFrameRef.current;
      if (!dialogFrame) return;
      const focusScope = getDialogFocusScope(dialogFrame);
      const firstFocusableElement = getFocusableElements(focusScope)[0];
      if (firstFocusableElement) {
        firstFocusableElement.focus();
      } else {
        focusScope.focus();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (focusContainmentReleasedRef.current) return;

      // Nested controls such as the Research player may consume Escape for an
      // in-context surface before the dialog itself should be dismissed.
      if (event.defaultPrevented) return;

      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab") return;

      const dialogFrame = dialogFrameRef.current;
      if (!dialogFrame) return;
      const focusScope = getDialogFocusScope(dialogFrame);

      const focusableElements = getFocusableElements(focusScope);
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements.at(-1);

      if (!firstFocusableElement || !lastFocusableElement) {
        event.preventDefault();
        focusScope.focus();
        return;
      }

      if (!focusScope.contains(document.activeElement)) {
        event.preventDefault();
        firstFocusableElement.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (focusContainmentReleasedRef.current) return;

      const dialogFrame = dialogFrameRef.current;
      if (!dialogFrame) return;
      const focusScope = getDialogFocusScope(dialogFrame);
      if (event.target instanceof Node && focusScope.contains(event.target)) return;
      focusFirstDialogControl();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [hasModalLifecycle, isTopmost, requestClose]);

  function handleBackdropClick(event: ReactMouseEvent<HTMLElement>) {
    if (event.target === event.currentTarget && dialogState !== "closing" && isTopmost) {
      requestClose();
    }
  }

  function handleNativeCancel(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (dialogState !== "closing" && isTopmost) requestClose();
  }

  if (!mounted || (!isInPlace && !portalReady)) return null;

  const portalDialog = (
    <div
      aria-hidden={isAccessible ? undefined : "true"}
      className={["modal-dialog", rootClassName].filter(Boolean).join(" ")}
      data-testid={dataTestId}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      data-state={dialogState}
      data-topmost={isTopmost ? "true" : "false"}
      onClick={handleBackdropClick}
      ref={setDialogRoot}
    >
      <div
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-modal={isTopmost ? "true" : undefined}
        className={["modal-dialog__frame", frameClassName].filter(Boolean).join(" ")}
        data-state={dialogState}
        id={dialogId}
        onClick={(event) => event.stopPropagation()}
        ref={dialogFrameRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );

  if (!isInPlace) return createPortal(portalDialog, document.body);

  const isInactive = !hasModalLifecycle;

  return (
    <dialog
      aria-describedby={isInactive ? undefined : ariaDescribedBy}
      aria-label={isInactive ? undefined : ariaLabel}
      aria-labelledby={isInactive ? undefined : ariaLabelledBy}
      aria-hidden={isInactive || isAccessible ? undefined : "true"}
      aria-modal={isInactive ? undefined : "true"}
      className={["modal-dialog", "modal-dialog--in-place", rootClassName].filter(Boolean).join(" ")}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      data-state={dialogState}
      data-testid={dataTestId}
      data-topmost={isTopmost ? "true" : "false"}
      id={dialogId}
      onCancel={handleNativeCancel}
      onClick={handleBackdropClick}
      ref={setNativeDialogRoot}
      role={isInactive ? "presentation" : "dialog"}
      tabIndex={isInactive ? undefined : -1}
    >
      <div
        className={["modal-dialog__frame", frameClassName].filter(Boolean).join(" ")}
        data-state={dialogState}
        onClick={(event) => event.stopPropagation()}
        ref={dialogFrameRef}
      >
        {children}
      </div>
    </dialog>
  );
}
