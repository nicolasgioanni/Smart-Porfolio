"use client";

import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";

export const modalDialogFadeMs = 180;

type DialogState = "opening" | "open" | "closing";

type ModalDialogAccessibleName =
  | { ariaLabel: string; ariaLabelledBy?: never }
  | { ariaLabel?: never; ariaLabelledBy: string };

type ModalDialogProps = ModalDialogAccessibleName & {
  ariaDescribedBy?: string;
  children: ReactNode;
  dialogId: string;
  frameClassName?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  onAfterClose?: () => void;
  onRequestClose: () => void;
  open: boolean;
  restoreFocusRef?: RefObject<HTMLElement>;
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

function registerModalDialog(instanceId: ModalDialogInstanceId) {
  promoteModalDialog(instanceId);
  let released = false;

  return () => {
    if (released) return;
    released = true;

    const existingIndex = modalDialogStack.lastIndexOf(instanceId);
    if (existingIndex < 0) return;

    modalDialogStack.splice(existingIndex, 1);
    notifyModalDialogStack();
  };
}

function isTopmostModalDialog(instanceId: ModalDialogInstanceId) {
  return getTopmostModalDialogId() === instanceId;
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
    (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true"
  );
}

export function ModalDialog({
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  children,
  dialogId,
  frameClassName,
  initialFocusRef,
  onAfterClose,
  onRequestClose,
  open,
  restoreFocusRef,
  rootClassName
}: ModalDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>("opening");
  const [mounted, setMounted] = useState(open);
  const [portalReady, setPortalReady] = useState(false);
  const dialogFrameRef = useRef<HTMLDivElement>(null);
  const closeRequestedRef = useRef(false);
  const dialogInstanceIdRef = useRef<ModalDialogInstanceId>(Symbol("modal-dialog"));
  const focusContainmentReleasedRef = useRef(false);
  const initialFocusAppliedRef = useRef(false);
  const onAfterCloseRef = useRef(onAfterClose);
  const onRequestCloseRef = useRef(onRequestClose);
  const prefersReducedMotion = useReducedMotionPreference();
  const topmostDialogId = useSyncExternalStore(
    subscribeToModalDialogStack,
    getTopmostModalDialogId,
    getServerTopmostModalDialogId
  );
  const isTopmost = mounted && topmostDialogId === dialogInstanceIdRef.current;

  onAfterCloseRef.current = onAfterClose;
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
    if (!mounted) return;
    return registerModalDialog(dialogInstanceIdRef.current);
  }, [mounted]);

  useEffect(() => {
    if (mounted && open) promoteModalDialog(dialogInstanceIdRef.current);
  }, [mounted, open]);

  useEffect(() => {
    if (open) {
      closeRequestedRef.current = false;
      focusContainmentReleasedRef.current = false;
      setMounted(true);
      setDialogState("opening");

      const openTimeout = window.setTimeout(() => setDialogState("open"), 0);
      return () => window.clearTimeout(openTimeout);
    }

    if (!mounted) return;

    setDialogState("closing");
    const closeTimeout = window.setTimeout(
      () => {
        const restoreTarget = restoreFocusRef?.current;

        focusContainmentReleasedRef.current = true;
        setMounted(false);
        setDialogState("opening");
        onAfterCloseRef.current?.();

        if (isTopmostModalDialog(dialogInstanceIdRef.current) && restoreTarget?.isConnected) {
          restoreTarget.focus();
        }
      },
      prefersReducedMotion ? 0 : modalDialogFadeMs
    );

    return () => window.clearTimeout(closeTimeout);
  }, [mounted, open, prefersReducedMotion, restoreFocusRef]);

  useEffect(() => {
    if (!mounted) return;
    return acquireBodyScrollLock();
  }, [mounted]);

  useEffect(() => {
    if (!open) {
      initialFocusAppliedRef.current = false;
      return;
    }

    if (!mounted || !isTopmost || initialFocusAppliedRef.current) return;

    initialFocusAppliedRef.current = true;
    const focusTimeout = window.setTimeout(() => {
      (initialFocusRef?.current ?? dialogFrameRef.current)?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimeout);
  }, [initialFocusRef, isTopmost, mounted, open]);

  useEffect(() => {
    if (!mounted || !isTopmost) return;

    function focusFirstDialogControl() {
      const dialogFrame = dialogFrameRef.current;
      if (!dialogFrame) return;
      const firstFocusableElement = getFocusableElements(dialogFrame)[0];
      if (firstFocusableElement) {
        firstFocusableElement.focus();
      } else {
        dialogFrame.focus();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (focusContainmentReleasedRef.current) return;

      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab") return;

      const dialogFrame = dialogFrameRef.current;
      if (!dialogFrame) return;

      const focusableElements = getFocusableElements(dialogFrame);
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements.at(-1);

      if (!firstFocusableElement || !lastFocusableElement) {
        event.preventDefault();
        dialogFrame.focus();
        return;
      }

      if (!dialogFrame.contains(document.activeElement)) {
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
      if (!dialogFrame || (event.target instanceof Node && dialogFrame.contains(event.target))) return;
      focusFirstDialogControl();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isTopmost, mounted, requestClose]);

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && dialogState !== "closing" && isTopmost) {
      requestClose();
    }
  }

  if (!portalReady || !mounted) return null;

  const dialog = (
    <div
      aria-hidden={isTopmost ? undefined : "true"}
      className={["modal-dialog", rootClassName].filter(Boolean).join(" ")}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      data-state={dialogState}
      data-topmost={isTopmost ? "true" : "false"}
      onClick={handleBackdropClick}
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

  return createPortal(dialog, document.body);
}
