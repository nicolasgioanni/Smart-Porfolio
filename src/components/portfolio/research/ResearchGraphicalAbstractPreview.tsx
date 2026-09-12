"use client";

import { useId, useRef, useState } from "react";
import { ModalDialog } from "@/components/overlay/ModalDialog";
import type { ResearchGraphicalAbstract } from "@/lib/content/researchGraphicalAbstracts";

type ResearchGraphicalAbstractPreviewProps = {
  abstract: ResearchGraphicalAbstract;
  title: string;
};

export function ResearchGraphicalAbstractPreview({
  abstract,
  title
}: ResearchGraphicalAbstractPreviewProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogId = `research-abstract-${useId().replaceAll(":", "")}`;

  return (
    <>
      <figure className="research-abstract">
        <figcaption className="research-media-title research-abstract__title">{abstract.displayTitle}</figcaption>
        <button
          aria-controls={dialogId}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Open graphical abstract for ${title}`}
          className="research-abstract__trigger"
          onClick={() => setOpen(true)}
          ref={triggerRef}
          type="button"
        >
          <img
            alt=""
            className="research-abstract__thumbnail"
            decoding="async"
            height={abstract.height}
            loading="lazy"
            src={abstract.src}
            width={abstract.width}
          />
          <span aria-hidden="true" className="research-abstract__hint">
            View larger
          </span>
        </button>
      </figure>

      <ModalDialog
        ariaLabel={`Graphical abstract for ${title}`}
        dialogId={dialogId}
        frameClassName="research-abstract-dialog__frame"
        initialFocusRef={closeButtonRef}
        onRequestClose={() => setOpen(false)}
        open={open}
        restoreFocusRef={triggerRef}
        rootClassName="research-abstract-dialog"
      >
        <button
          aria-label={`Close graphical abstract for ${title}`}
          className="research-abstract-dialog__close hover-base-1 hover-base-1--compact"
          onClick={() => setOpen(false)}
          ref={closeButtonRef}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
        <figure className="research-abstract-dialog__figure">
          <img
            alt={abstract.alt}
            className="research-abstract-dialog__image"
            decoding="async"
            height={abstract.height}
            src={abstract.src}
            width={abstract.width}
          />
        </figure>
      </ModalDialog>
    </>
  );
}
