"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { ModalDialog } from "@/components/overlay/ModalDialog";

type ResearchMediaDialogProps = {
  ariaDescribedBy?: string;
  ariaLabel: string;
  children: ReactNode;
  closeLabel: string;
  dialogId: string;
  frameClassName?: string;
  kind: "abstract" | "video";
  onAfterClose?: () => void;
  onRequestClose: () => void;
  open: boolean;
  restoreFocusRef: RefObject<HTMLElement | null>;
};

/**
 * Shared Research-media composition around the common portal, focus, and
 * dismissal lifecycle. Consumers supply only their media and an accessible
 * close label; the frame geometry remains one responsive contract.
 */
export function ResearchMediaDialog({
  ariaDescribedBy,
  ariaLabel,
  children,
  closeLabel,
  dialogId,
  frameClassName,
  kind,
  onAfterClose,
  onRequestClose,
  open,
  restoreFocusRef
}: ResearchMediaDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      ariaDescribedBy={ariaDescribedBy}
      ariaLabel={ariaLabel}
      dataTestId="research-media-dialog"
      dialogId={dialogId}
      frameClassName={["research-media-dialog__frame", frameClassName].filter(Boolean).join(" ")}
      initialFocusRef={closeButtonRef}
      onAfterClose={onAfterClose}
      onRequestClose={onRequestClose}
      open={open}
      restoreFocusRef={restoreFocusRef}
      rootClassName={`research-media-dialog research-media-dialog--${kind}`}
    >
      <button
        aria-label={closeLabel}
        className="research-media-dialog__close hover-base-1 hover-base-1--compact"
        onClick={onRequestClose}
        ref={closeButtonRef}
        type="button"
      >
        <span aria-hidden="true">×</span>
      </button>
      {children}
    </ModalDialog>
  );
}
