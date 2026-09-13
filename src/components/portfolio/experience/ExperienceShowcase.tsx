"use client";

import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import type { ExperienceItem } from "@/content/types";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { PageContainer } from "@/components/layout/PageContainer";
import { DetailDisclosureList } from "@/components/portfolio/shared/DetailDisclosureList";
import { DetailLevelControl } from "@/components/portfolio/shared/DetailLevelControl";
import { EmptyState } from "@/components/portfolio/shared/EmptyState";
import { useDetailDisclosure } from "@/components/portfolio/shared/useDetailDisclosure";
import type { DetailMode } from "@/lib/content/detailNarratives";
import { getExperienceModeContent } from "@/lib/content/experienceNarratives";
import { formatProfileOverviewDateRange } from "@/lib/content/profileOverview";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";

type ExperienceShowcaseProps = {
  items: ExperienceItem[];
  motionEnabled?: boolean;
  summary: string;
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

export function ExperienceShowcase({ items, motionEnabled = true, summary }: ExperienceShowcaseProps) {
  const [mode, setMode] = useState<DetailMode>("overview");
  const showcaseRef = useRef<HTMLDivElement>(null);
  const { close, onFocusCapture, openDetail, toggle, usesNaturalFlow } = useDetailDisclosure(showcaseRef);

  function changeMode(nextMode: DetailMode) {
    setMode(nextMode);
    close();
  }

  return (
    <PageContainer
      className="page-container--experience"
      description={summary}
      introAccessory={
        items.length > 0 ? <DetailLevelControl contextLabel="Experience" mode={mode} onChange={changeMode} /> : undefined
      }
      introVariant="panel"
      motionEnabled={motionEnabled}
      title={routeHeaderContent["/experience"].title}
    >
      <div
        className="experience-showcase"
        data-motion={motionEnabled ? "enabled" : "disabled"}
        onFocusCapture={onFocusCapture}
        ref={showcaseRef}
      >
        {items.length === 0 ? (
          <EmptyState message="Experience entries will appear here when content is available." />
        ) : (
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
                      <DetailDisclosureList
                        idPrefix="experience"
                        itemId={item.id}
                        mode={mode}
                        onToggle={(sectionId) => toggle(item.id, sectionId)}
                        openSectionId={openDetail?.itemId === item.id ? openDetail.sectionId : undefined}
                        overlayEnabled={!usesNaturalFlow}
                        sections={modeContent.sections}
                      />
                    </div>
                  </GlassSurface>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
