"use client";

import type { RefObject } from "react";
import { useId, useRef } from "react";
import { ModalDialog } from "@/components/overlay/ModalDialog";

type ProfileImagePreviewProps = {
  alt: string;
  imageSrc: string;
  onClose: () => void;
  open: boolean;
  restoreFocusRef: RefObject<HTMLElement | null>;
};

export function ProfileImagePreview({ alt, imageSrc, onClose, open, restoreFocusRef }: ProfileImagePreviewProps) {
  const dialogId = `profile-image-preview-${useId().replaceAll(":", "")}`;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      ariaLabel={alt}
      dialogId={dialogId}
      frameClassName="profile-image-preview__frame"
      initialFocusRef={closeButtonRef}
      onRequestClose={onClose}
      open={open}
      restoreFocusRef={restoreFocusRef}
      rootClassName="profile-image-preview"
    >
      <img alt={alt} className="profile-image-preview__image" src={imageSrc} />
      <div className="profile-image-preview__actions">
        <button
          aria-label="Close profile photo preview"
          className="profile-image-preview__close hover-base-1 hover-base-1--compact"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          Close
        </button>
      </div>
    </ModalDialog>
  );
}
