"use client";

import { useState } from "react";
import type { ResearchItem } from "@/content/types";
import { PageContainer } from "@/components/layout/PageContainer";
import { DetailLevelControl } from "@/components/portfolio/DetailLevelControl";
import { ResearchList } from "@/components/portfolio/ResearchList";
import type { DetailMode } from "@/lib/content/detailNarratives";

type ResearchShowcaseProps = {
  items: ResearchItem[];
  motionEnabled?: boolean;
};

const researchSummary =
  "My research centers on CytoCV and adversarial machine learning, with additional work in computational biology automation.";

export function ResearchShowcase({ items, motionEnabled = true }: ResearchShowcaseProps) {
  const [mode, setMode] = useState<DetailMode>("overview");
  const [openByProject, setOpenByProject] = useState<Record<string, string | undefined>>({});

  function toggleSection(itemId: string, sectionId: string) {
    setOpenByProject((current) => ({
      ...current,
      [itemId]: current[itemId] === sectionId ? undefined : sectionId
    }));
  }

  return (
    <PageContainer
      className="page-container--research"
      description={researchSummary}
      introAccessory={
        items.length > 0 ? <DetailLevelControl contextLabel="Research" mode={mode} onChange={setMode} /> : undefined
      }
      introVariant="panel"
      motionEnabled={motionEnabled}
      title="Applied AI Research"
    >
      <ResearchList
        items={items}
        mode={mode}
        motionEnabled={motionEnabled}
        onToggle={toggleSection}
        openByProject={openByProject}
      />
    </PageContainer>
  );
}
