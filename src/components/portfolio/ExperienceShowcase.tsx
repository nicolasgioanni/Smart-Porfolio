"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useState } from "react";
import type { ExperienceItem } from "@/content/types";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { EmptyState } from "@/components/portfolio/EmptyState";
import {
  getExperienceModeContent,
  type ExperienceDetailMode,
  type ExperienceDetailSection
} from "@/lib/content/experienceNarratives";
import { formatProfileOverviewDateRange } from "@/lib/content/profileOverview";

type ExperienceShowcaseProps = {
  items: ExperienceItem[];
  motionEnabled?: boolean;
};

const modeCopy: Record<ExperienceDetailMode, { description: string; label: string }> = {
  overview: {
    label: "For everyone",
    description: "A plain-language look at what I built, who it helped, and the outcomes."
  },
  technical: {
    label: "Technical",
    description: "Architecture, implementation details, tooling, and measurable results."
  }
};

const initialsStopWords = new Set(["and", "at", "for", "of", "on", "the"]);

function getOrganizationInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
    .filter((word) => word && !initialsStopWords.has(word.toLowerCase()));
  const firstWord = words[0];

  if (!firstWord) return "?";
  if (/^[A-Z]{2,4}$/.test(firstWord)) return `${firstWord}${words[1]?.[0] ?? ""}`.slice(0, 3).toUpperCase();

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatRoleType(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function isCurrentRole(item: ExperienceItem): boolean {
  const normalizedEndDate = item.endDate?.trim().toLowerCase();
  return !normalizedEndDate || normalizedEndDate === "present" || normalizedEndDate === "current";
}

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

type ExperienceChapterProps = {
  itemId: string;
  mode: ExperienceDetailMode;
  onToggle: () => void;
  open: boolean;
  order: number;
  section: ExperienceDetailSection;
};

function ExperienceChapter({ itemId, mode, onToggle, open, order, section }: ExperienceChapterProps) {
  const chapterId = `experience-${safeId(itemId)}-${mode}-${safeId(section.id)}`;
  const panelId = `${chapterId}-panel`;
  const titleId = `${chapterId}-title`;
  const expandable = section.details.length > 0 || Boolean(section.tools?.length);

  const chapterSummary = (
    <>
      <span aria-hidden="true" className="experience-chapter__number">
        {String(order + 1).padStart(2, "0")}
      </span>
      <span className="experience-chapter__copy">
        <span aria-level={3} className="experience-chapter__title" id={titleId} role="heading">
          {section.title}
        </span>
        <span className="experience-chapter__lead">{section.lead}</span>
      </span>
      {section.signal ? <span className="experience-chapter__signal">{section.signal}</span> : null}
    </>
  );

  if (!expandable) {
    return (
      <div className="experience-chapter experience-chapter--static">
        <div className="experience-chapter__trigger experience-chapter__trigger--static">{chapterSummary}</div>
      </div>
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      onToggle();
    }
  }

  return (
    <div className="experience-chapter" data-open={open ? "true" : "false"}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="experience-chapter__trigger"
        id={chapterId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        type="button"
      >
        {chapterSummary}
        <span aria-hidden="true" className="experience-chapter__icon">
          <DisclosureIcon />
        </span>
      </button>
      <div
        aria-hidden={!open}
        aria-labelledby={titleId}
        className="experience-chapter__panel"
        id={panelId}
        role="region"
      >
        <div className="experience-chapter__panel-clip">
          <div className="experience-chapter__panel-content">
            {section.details.length > 0 ? (
              <div className="experience-chapter__details">
                {section.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>
            ) : null}
            {section.tools && section.tools.length > 0 ? (
              <ul aria-label={`${section.title} tools`} className="experience-chapter__tools">
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

export function ExperienceShowcase({ items, motionEnabled = true }: ExperienceShowcaseProps) {
  const [mode, setMode] = useState<ExperienceDetailMode>("overview");
  const [openByRole, setOpenByRole] = useState<Record<string, string | undefined>>({});

  if (items.length === 0) {
    return <EmptyState message="Experience entries will appear here when content is available." />;
  }

  function toggleSection(itemId: string, sectionId: string) {
    setOpenByRole((current) => ({
      ...current,
      [itemId]: current[itemId] === sectionId ? undefined : sectionId
    }));
  }

  return (
    <div className="experience-showcase" data-motion={motionEnabled ? "enabled" : "disabled"}>
      <GlassSurface as="section" className="experience-mode-control" variant="subtle">
        <div className="experience-mode-control__copy">
          <p className="experience-mode-control__eyebrow">Detail level</p>
          <p aria-live="polite" className="experience-mode-control__description">
            {modeCopy[mode].description}
          </p>
        </div>
        <div aria-label="Experience detail level" className="experience-mode-switch" data-mode={mode} role="group">
          <span aria-hidden="true" className="experience-mode-switch__lens" />
          {(Object.keys(modeCopy) as ExperienceDetailMode[]).map((modeOption) => (
            <button
              aria-pressed={mode === modeOption}
              className="experience-mode-switch__button"
              key={modeOption}
              onClick={() => setMode(modeOption)}
              type="button"
            >
              {modeCopy[modeOption].label}
            </button>
          ))}
        </div>
      </GlassSurface>

      <div className="experience-showcase__roles">
        {items.map((item, itemIndex) => {
          const modeContent = getExperienceModeContent(item, mode);
          const dateLabel = formatProfileOverviewDateRange(item.startDate, item.endDate);
          const current = isCurrentRole(item);
          const roleStyle = { "--experience-order": itemIndex } as CSSProperties;

          return (
            <div className="experience-card-wrap" key={item.id} style={roleStyle}>
              <GlassSurface as="article" className="experience-card">
                <header className="experience-card__header">
                  <div
                    className={[
                      "experience-card__mark",
                      item.organizationLogo ? "experience-card__mark--image" : null
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {item.organizationLogo ? (
                      <img
                        alt=""
                        aria-hidden="true"
                        className="experience-card__logo"
                        decoding="async"
                        height="64"
                        loading="lazy"
                        src={item.organizationLogo}
                        width="64"
                      />
                    ) : (
                      <span aria-hidden="true" className="experience-card__initials">
                        {getOrganizationInitials(item.organization)}
                      </span>
                    )}
                  </div>

                  <div className="experience-card__identity">
                    <div className="experience-card__organization-row">
                      <p className="experience-card__organization">{item.organization}</p>
                      <span aria-hidden="true" className="experience-card__index">
                        {String(itemIndex + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h2 className="experience-card__title">{item.title}</h2>
                    <div className="experience-card__metadata">
                      {dateLabel ? <span>{dateLabel}</span> : null}
                      {item.location ? <span>{item.location}</span> : null}
                      {item.type ? <span className="experience-card__badge">{formatRoleType(item.type)}</span> : null}
                      {current ? (
                        <span className="experience-card__badge experience-card__badge--current">
                          <span aria-hidden="true" className="experience-card__status-dot" />
                          Current
                        </span>
                      ) : null}
                    </div>
                  </div>
                </header>

                <div className="experience-card__body" key={mode}>
                  <p className="experience-card__summary">{modeContent.summary}</p>
                  {modeContent.sections.length > 0 ? (
                    <div className="experience-card__chapters">
                      {modeContent.sections.map((section, sectionIndex) => (
                        <ExperienceChapter
                          itemId={item.id}
                          key={section.id}
                          mode={mode}
                          onToggle={() => toggleSection(item.id, section.id)}
                          open={openByRole[item.id] === section.id}
                          order={sectionIndex}
                          section={section}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </GlassSurface>
            </div>
          );
        })}
      </div>
    </div>
  );
}
