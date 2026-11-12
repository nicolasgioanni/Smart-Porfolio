"use client";

import { useCallback, useId, useRef, useState } from "react";
import { SkillIcon } from "@/components/icons/SkillIcon";
import { ModalDialog, modalDialogFadeMs } from "@/components/overlay/ModalDialog";

export const interactiveSkillDialogFadeMs = modalDialogFadeMs;

export type InteractiveSkillShowcaseItem = {
  name: string;
  compactName?: string;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DialogItem<TItem> | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);

  const requestClose = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const finishClosing = useCallback(() => {
    restoreFocusRef.current = null;
    setSelectedItem(null);
  }, []);

  function openDialog(item: DialogItem<TItem>, trigger: HTMLButtonElement) {
    restoreFocusRef.current = trigger;
    setSelectedItem(item);
    setDialogOpen(true);
  }

  const dialog = selectedItem ? (
    <ModalDialog
      ariaDescribedBy={`${dialogContextId} ${dialogSummaryId}`}
      ariaLabelledBy={dialogTitleId}
      dialogId={dialogId}
      frameClassName={`${dialogClassName}__frame`}
      initialFocusRef={closeButtonRef}
      onAfterClose={finishClosing}
      onRequestClose={requestClose}
      open={dialogOpen}
      restoreFocusRef={restoreFocusRef}
      rootClassName={dialogClassName}
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
    </ModalDialog>
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
                  aria-expanded={dialogOpen && selectedItem?.name === item.name}
                  aria-haspopup="dialog"
                  aria-label={getTriggerAriaLabel(item)}
                  className={`${outerClassName}__trigger skill-badge hover-base-1 hover-base-1--compact`}
                  onClick={(event) => openDialog(dialogItem, event.currentTarget)}
                  type="button"
                >
                  {item.icon ? <SkillIcon icon={item.icon} /> : null}
                  <SkillLabel item={item} />
                </button>
              ) : (
                <span className={`${outerClassName}__badge skill-badge`}>
                  {item.icon ? <SkillIcon icon={item.icon} /> : null}
                  <SkillLabel item={item} />
                </span>
              )}
            </span>
          );
        })}
      </div>

      {dialog}
    </>
  );
}

function SkillLabel({ item }: { item: InteractiveSkillShowcaseItem }) {
  return item.compactName ? (
    <span className="skill-badge__label">
      <span className="skill-badge__full-name">{item.name}</span>
      <span className="skill-badge__compact-name" aria-label={item.name}>{item.compactName}</span>
    </span>
  ) : <span className="skill-badge__label">{item.name}</span>;
}
