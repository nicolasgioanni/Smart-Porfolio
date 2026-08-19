import type { ReactNode } from "react";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { PageContainer } from "@/components/layout/PageContainer";

const fallbackEffectiveDate = {
  iso: "2026-08-07",
  label: "August 7, 2026"
} as const;

const fallbackContactEmail = "ngioanni@uw.edu";

export type LegalEffectiveDate = {
  iso: string;
  label: string;
};

type LegalDocumentProps = {
  children: ReactNode;
  description: string;
  effectiveDate: LegalEffectiveDate;
  eyebrow?: string;
  motionEnabled?: boolean;
  title: string;
};

export function resolveLegalEffectiveDate(value: unknown): LegalEffectiveDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return fallbackEffectiveDate;
  }

  const iso = value.trim();
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return fallbackEffectiveDate;
  }

  return {
    iso,
    label: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      year: "numeric"
    }).format(date)
  };
}

export function resolveLegalContactEmail(value: unknown): string {
  if (typeof value !== "string") return fallbackContactEmail;

  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : fallbackContactEmail;
}

export function LegalDocument({
  children,
  description,
  effectiveDate,
  eyebrow = "Site notice",
  motionEnabled = true,
  title
}: LegalDocumentProps) {
  return (
    <PageContainer
      className="page-container--legal"
      description={description}
      eyebrow={eyebrow}
      motionEnabled={motionEnabled}
      title={title}
    >
      <GlassSurface as="article" className="legal-document" variant="strong">
        <header className="legal-document__meta">
          <h2 className="visually-hidden">Notice details</h2>
          <p className="legal-document__effective-date">
            <span>Effective date:</span>{" "}
            <time dateTime={effectiveDate.iso}>{effectiveDate.label}</time>
          </p>
        </header>
        <div className="legal-document__body">{children}</div>
      </GlassSurface>
    </PageContainer>
  );
}
