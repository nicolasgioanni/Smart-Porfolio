import type { KeyboardEvent } from "react";
import type { DetailMode, DetailSection } from "@/lib/content/detailNarratives";

type DetailDisclosureListProps = {
  idPrefix: string;
  itemId: string;
  mode: DetailMode;
  onToggle: (sectionId: string) => void;
  openSectionId?: string;
  sections: DetailSection[];
};

type DetailDisclosureProps = Omit<DetailDisclosureListProps, "openSectionId" | "sections"> & {
  open: boolean;
  order: number;
  section: DetailSection;
};

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function DisclosureIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function DetailDisclosure({ idPrefix, itemId, mode, onToggle, open, order, section }: DetailDisclosureProps) {
  const disclosureId = `${safeId(idPrefix)}-${safeId(itemId)}-${mode}-${safeId(section.id)}`;
  const panelId = `${disclosureId}-panel`;
  const titleId = `${disclosureId}-title`;
  const expandable = section.details.length > 0 || Boolean(section.tools?.length);

  const summary = (
    <>
      <span aria-hidden="true" className="detail-section__number">
        {String(order + 1).padStart(2, "0")}
      </span>
      <span className="detail-section__copy">
        <span aria-level={3} className="detail-section__title" id={titleId} role="heading">
          {section.title}
        </span>
        <span className="detail-section__lead">{section.lead}</span>
      </span>
      {section.signal ? <span className="detail-section__signal">{section.signal}</span> : null}
    </>
  );

  if (!expandable) {
    return (
      <div className="detail-section detail-section--static">
        <div className="detail-section__trigger detail-section__trigger--static">{summary}</div>
      </div>
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      onToggle(section.id);
    }
  }

  return (
    <div className="detail-section" data-open={open ? "true" : "false"}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="detail-section__trigger"
        id={disclosureId}
        onClick={() => onToggle(section.id)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        {summary}
        <span aria-hidden="true" className="detail-section__icon">
          <DisclosureIcon />
        </span>
      </button>
      <div
        aria-hidden={!open}
        aria-labelledby={titleId}
        className="detail-section__panel"
        id={panelId}
        role="region"
      >
        <div className="detail-section__panel-clip">
          <div className="detail-section__panel-content">
            {section.details.length > 0 ? (
              <ul className="detail-section__details">
                {section.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            {section.tools && section.tools.length > 0 ? (
              <ul aria-label={`${section.title} tools`} className="detail-section__tools">
                {section.tools.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailDisclosureList({
  idPrefix,
  itemId,
  mode,
  onToggle,
  openSectionId,
  sections
}: DetailDisclosureListProps) {
  if (sections.length === 0) return null;

  return (
    <div className="detail-list">
      {sections.map((section, index) => (
        <DetailDisclosure
          idPrefix={idPrefix}
          itemId={itemId}
          key={section.id}
          mode={mode}
          onToggle={onToggle}
          open={openSectionId === section.id}
          order={index}
          section={section}
        />
      ))}
    </div>
  );
}
