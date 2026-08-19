"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SkillIcon } from "@/components/icons/SkillIcon";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";
import type { ProjectSkill } from "@/content/types";

export const projectSkillDialogFadeMs = 180;

type ProjectSkillShowcaseProps = {
  projectTitle: string;
  skills: readonly ProjectSkill[];
};

type DialogSkill = ProjectSkill & {
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

function getDialogSkill(skill: ProjectSkill): DialogSkill | null {
  const details = skill.details?.trim();
  const summary = skill.summary?.trim();

  if (!details || !summary) return null;

  return {
    ...skill,
    details,
    summary
  };
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableElementSelector)).filter(
    (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true"
  );
}

export function ProjectSkillShowcase({ projectTitle, skills }: ProjectSkillShowcaseProps) {
  const dialogInstanceId = useId().replaceAll(":", "");
  const dialogId = `project-skill-dialog-${dialogInstanceId}`;
  const dialogTitleId = `${dialogId}-title`;
  const dialogContextId = `${dialogId}-context`;
  const dialogSummaryId = `${dialogId}-summary`;
  const dialogDetailsTitleId = `${dialogId}-details-title`;
  const [portalReady, setPortalReady] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<DialogSkill | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>("opening");
  const dialogFrameRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion = useReducedMotionPreference();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!selectedSkill || dialogState !== "opening") return;

    const openTimeout = window.setTimeout(() => setDialogState("open"), 0);
    return () => window.clearTimeout(openTimeout);
  }, [dialogState, selectedSkill]);

  useEffect(() => {
    if (!selectedSkill) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimeout = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimeout);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [selectedSkill]);

  const finishClosing = useCallback(() => {
    const trigger = restoreFocusRef.current;

    restoreFocusRef.current = null;
    setSelectedSkill(null);
    setDialogState("opening");

    if (trigger?.isConnected) {
      trigger.focus();
    }
  }, []);

  useEffect(() => {
    if (!selectedSkill || dialogState !== "closing") return;

    const closeTimeout = window.setTimeout(
      finishClosing,
      prefersReducedMotion ? 0 : projectSkillDialogFadeMs
    );

    return () => window.clearTimeout(closeTimeout);
  }, [dialogState, finishClosing, prefersReducedMotion, selectedSkill]);

  const requestClose = useCallback(() => {
    if (!selectedSkill || dialogState === "closing") return;
    setDialogState("closing");
  }, [dialogState, selectedSkill]);

  useEffect(() => {
    if (!selectedSkill) return;

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
  }, [requestClose, selectedSkill]);

  function openDialog(skill: DialogSkill, trigger: HTMLButtonElement) {
    restoreFocusRef.current = trigger;
    setSelectedSkill(skill);
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

  const dialog = selectedSkill ? (
    <div
      className="project-skill-dialog"
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      data-state={dialogState}
      onClick={handleBackdropClick}
    >
      <div
        aria-describedby={`${dialogContextId} ${dialogSummaryId}`}
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="project-skill-dialog__frame"
        data-state={dialogState}
        id={dialogId}
        onClick={preventFrameClickFromClosing}
        ref={dialogFrameRef}
        role="dialog"
        tabIndex={-1}
      >
        {selectedSkill.icon ? (
          <div className="project-skill-dialog__icon">
            <SkillIcon icon={selectedSkill.icon} />
          </div>
        ) : null}

        <h2 className="project-skill-dialog__title" id={dialogTitleId}>
          {selectedSkill.name}
        </h2>

        <p className="project-skill-dialog__context" id={dialogContextId}>
          Used in {projectTitle}
        </p>

        <p className="project-skill-dialog__summary" id={dialogSummaryId}>
          {selectedSkill.summary}
        </p>

        <section aria-labelledby={dialogDetailsTitleId} className="project-skill-dialog__details">
          <h3 className="project-skill-dialog__details-title" id={dialogDetailsTitleId}>
            Technical details
          </h3>
          <p>{selectedSkill.details}</p>
        </section>

        <button
          aria-label={`Close ${selectedSkill.name} details`}
          className="project-skill-dialog__close hover-base-1 hover-base-1--compact"
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
      <div
        aria-label={`${projectTitle} technical skills`}
        className="project-skill-showcase"
        role="list"
      >
        {skills.map((skill, index) => {
          const dialogSkill = getDialogSkill(skill);
          const key = `${skill.name}-${index}`;

          return (
            <span className="project-skill-showcase__item" key={key} role="listitem">
              {dialogSkill ? (
                <button
                  aria-controls={dialogId}
                  aria-expanded={selectedSkill?.name === skill.name}
                  aria-haspopup="dialog"
                  aria-label={`Learn about ${skill.name} used in ${projectTitle}`}
                  className="project-skill-showcase__trigger skill-badge hover-base-1 hover-base-1--compact"
                  onClick={(event) => openDialog(dialogSkill, event.currentTarget)}
                  type="button"
                >
                  {skill.icon ? <SkillIcon icon={skill.icon} /> : null}
                  <span className="skill-badge__label">{skill.name}</span>
                </button>
              ) : (
                <span className="project-skill-showcase__badge skill-badge">
                  {skill.icon ? <SkillIcon icon={skill.icon} /> : null}
                  <span className="skill-badge__label">{skill.name}</span>
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
