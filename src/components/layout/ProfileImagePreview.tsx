"use client";

import { useEffect, useState } from "react";

const profilePreviewFadeMs = 160;

type ProfileImagePreviewProps = {
  alt: string;
  imageSrc: string;
  onClose: () => void;
  open: boolean;
};

export function ProfileImagePreview({ alt, imageSrc, onClose, open }: ProfileImagePreviewProps) {
  const [active, setActive] = useState(open);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      setActive(false);
    }

    const timeout = window.setTimeout(
      () => {
        if (open) {
          setActive(true);
        } else {
          setMounted(false);
        }
      },
      open ? 0 : profilePreviewFadeMs
    );

    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open && !mounted) return null;

  const previewState = open && active ? "open" : "closed";

  return (
    <div className="profile-image-preview" data-state={previewState} onClick={onClose}>
      <div aria-label={alt} aria-modal="true" className="profile-image-preview__frame" onClick={(event) => event.stopPropagation()} role="dialog">
        <img alt={alt} className="profile-image-preview__image" src={imageSrc} />
        <div className="profile-image-preview__actions">
          <button aria-label="Close profile photo preview" className="profile-image-preview__close" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
