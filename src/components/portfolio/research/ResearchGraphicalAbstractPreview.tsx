"use client";

import { useId, useRef, useState } from "react";
import { ResearchMediaDialog } from "@/components/portfolio/research/ResearchMediaDialog";
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

      <ResearchMediaDialog
        ariaLabel={`Graphical abstract for ${title}`}
        closeLabel={`Close graphical abstract for ${title}`}
        dialogId={dialogId}
        frameClassName="research-media-dialog__frame--abstract"
        kind="abstract"
        onRequestClose={() => setOpen(false)}
        open={open}
        restoreFocusRef={triggerRef}
      >
        <figure className="research-media-dialog__figure">
          <img
            alt={abstract.alt}
            className="research-media-dialog__image"
            decoding="async"
            height={abstract.height}
            src={abstract.src}
            width={abstract.width}
          />
        </figure>
      </ResearchMediaDialog>
    </>
  );
}
