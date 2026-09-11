"use client";

import { useState } from "react";
import type { ResearchItem } from "@/content/types";
import { PageContainer } from "@/components/layout/PageContainer";
import { DetailLevelControl } from "@/components/portfolio/DetailLevelControl";
import { ResearchList } from "@/components/portfolio/ResearchList";
import type { DetailMode } from "@/lib/content/detailNarratives";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";

type ResearchShowcaseProps = {
  items: ResearchItem[];
  motionEnabled?: boolean;
};

const researchHeader = routeHeaderContent["/research"];

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
      description={researchHeader.description}
      introAccessory={
        items.length > 0 ? <DetailLevelControl contextLabel="Research" mode={mode} onChange={setMode} /> : undefined
      }
      introVariant="panel"
      motionEnabled={motionEnabled}
      title={researchHeader.title}
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
