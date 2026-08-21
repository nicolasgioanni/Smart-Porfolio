"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SkillIcon } from "@/components/icons/SkillIcon";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";

export const interactiveSkillDialogFadeMs = 180;

export type InteractiveSkillShowcaseItem = {
  name: string;
  icon?: string;
  summary?: string;
  details?: string;
};

type InteractiveSkillShowcaseProps<TItem extends InteractiveSkillShowcaseItem> = {
  detailsHeading: string;
  dialogClassName?: string;
  getCloseAriaLabel?: (item: TItem) => string;
  getContextText: (item: TItem) => string;
  getTriggerAriaLabel: (item: TItem) => string;
  items: readonly TItem[];
  listAriaLabel: string;
  outerClassName: string;
};

type DialogItem<TItem extends InteractiveSkillShowcaseItem> = TItem & {
  details: string;
  summary: string;
};

type DialogState = "opening" | "open" | "closing";

const focusableElementSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function getDialogItem<TItem extends InteractiveSkillShowcaseItem>(
  item: TItem
): DialogItem<TItem> | null {
  const details = item.details?.trim();
  const summary = item.summary?.trim();

  if (!details || !summary) return null;

  return {
    ...item,
    details,
    summary
  };
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableElementSelector)).filter(
    (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true"
  );
}

export function InteractiveSkillShowcase<TItem extends InteractiveSkillShowcaseItem>({
  detailsHeading,
  dialogClassName = "project-skill-dialog",
  getCloseAriaLabel = (item) => `Close ${item.name} details`,
  getContextText,
  getTriggerAriaLabel,
  items,
  listAriaLabel,
  outerClassName
}: InteractiveSkillShowcaseProps<TItem>) {
  const dialogInstanceId = useId().replaceAll(":", "");
  const dialogId = `${dialogClassName}-${dialogInstanceId}`;
  const dialogTitleId = `${dialogId}-title`;
  const dialogContextId = `${dialogId}-context`;
  const dialogSummaryId = `${dialogId}-summary`;
  const dialogDetailsTitleId = `${dialogId}-details-title`;
  const [portalReady, setPortalReady] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DialogItem<TItem> | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>("opening");
  const dialogFrameRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion = useReducedMotionPreference();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!selectedItem || dialogState !== "opening") return;

    const openTimeout = window.setTimeout(() => setDialogState("open"), 0);
    return () => window.clearTimeout(openTimeout);
  }, [dialogState, selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimeout = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimeout);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [selectedItem]);

  const finishClosing = useCallback(() => {
    const trigger = restoreFocusRef.current;

    restoreFocusRef.current = null;
    setSelectedItem(null);
    setDialogState("opening");

    if (trigger?.isConnected) {
      trigger.focus();
    }
  }, []);

  useEffect(() => {
    if (!selectedItem || dialogState !== "closing") return;

    const closeTimeout = window.setTimeout(
      finishClosing,
      prefersReducedMotion ? 0 : interactiveSkillDialogFadeMs
    );

    return () => window.clearTimeout(closeTimeout);
  }, [dialogState, finishClosing, prefersReducedMotion, selectedItem]);

  const requestClose = useCallback(() => {
    if (!selectedItem || dialogState === "closing") return;
    setDialogState("closing");
  }, [dialogState, selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;

    function handleKeyDown(event: KeyboardEvent) {
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

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requestClose, selectedItem]);

  function openDialog(item: DialogItem<TItem>, trigger: HTMLButtonElement) {
    restoreFocusRef.current = trigger;
    setSelectedItem(item);
    setDialogState("opening");
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  }

  function preventFrameClickFromClosing(event: ReactMouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  const dialog = selectedItem ? (
    <div
      className={dialogClassName}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      data-state={dialogState}
      onClick={handleBackdropClick}
    >
      <div
        aria-describedby={`${dialogContextId} ${dialogSummaryId}`}
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className={`${dialogClassName}__frame`}
        data-state={dialogState}
        id={dialogId}
        onClick={preventFrameClickFromClosing}
        ref={dialogFrameRef}
        role="dialog"
        tabIndex={-1}
      >
        {selectedItem.icon ? (
          <div className={`${dialogClassName}__icon`}>
            <SkillIcon icon={selectedItem.icon} />
          </div>
        ) : null}

        <h2 className={`${dialogClassName}__title`} id={dialogTitleId}>
          {selectedItem.name}
        </h2>

        <p className={`${dialogClassName}__context`} id={dialogContextId}>
          {getContextText(selectedItem)}
        </p>

        <p className={`${dialogClassName}__summary`} id={dialogSummaryId}>
          {selectedItem.summary}
        </p>

        <section aria-labelledby={dialogDetailsTitleId} className={`${dialogClassName}__details`}>
          <h3 className={`${dialogClassName}__details-title`} id={dialogDetailsTitleId}>
            {detailsHeading}
          </h3>
          <p>{selectedItem.details}</p>
        </section>

        <button
          aria-label={getCloseAriaLabel(selectedItem)}
          className={`${dialogClassName}__close hover-base-1 hover-base-1--compact`}
          onClick={requestClose}
          ref={closeButtonRef}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div aria-label={listAriaLabel} className={outerClassName} role="list">
        {items.map((item, index) => {
          const dialogItem = getDialogItem(item);
          const key = `${item.name}-${index}`;

          return (
            <span className={`${outerClassName}__item`} key={key} role="listitem">
              {dialogItem ? (
                <button
                  aria-controls={dialogId}
                  aria-expanded={selectedItem?.name === item.name}
                  aria-haspopup="dialog"
                  aria-label={getTriggerAriaLabel(item)}
                  className={`${outerClassName}__trigger skill-badge hover-base-1 hover-base-1--compact`}
                  onClick={(event) => openDialog(dialogItem, event.currentTarget)}
                  type="button"
                >
                  {item.icon ? <SkillIcon icon={item.icon} /> : null}
                  <span className="skill-badge__label">{item.name}</span>
                </button>
              ) : (
                <span className={`${outerClassName}__badge skill-badge`}>
                  {item.icon ? <SkillIcon icon={item.icon} /> : null}
                  <span className="skill-badge__label">{item.name}</span>
                </span>
              )}
            </span>
          );
        })}
      </div>

      {portalReady && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
