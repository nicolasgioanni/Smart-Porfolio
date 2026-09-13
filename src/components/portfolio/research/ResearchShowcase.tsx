"use client";

import { useRef, useState } from "react";
import type { ResearchItem } from "@/content/types";
import { PageContainer } from "@/components/layout/PageContainer";
import { DetailLevelControl } from "@/components/portfolio/shared/DetailLevelControl";
import { useDetailDisclosure } from "@/components/portfolio/shared/useDetailDisclosure";
import { ResearchList } from "@/components/portfolio/research/ResearchList";
import type { DetailMode } from "@/lib/content/detailNarratives";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";

type ResearchShowcaseProps = {
  items: ResearchItem[];
  motionEnabled?: boolean;
};

const researchHeader = routeHeaderContent["/research"];

export function ResearchShowcase({ items, motionEnabled = true }: ResearchShowcaseProps) {
  const [mode, setMode] = useState<DetailMode>("overview");
  const showcaseRef = useRef<HTMLDivElement>(null);
  const { close, onFocusCapture, openDetail, toggle, usesNaturalFlow } = useDetailDisclosure(showcaseRef);

  function changeMode(nextMode: DetailMode) {
    setMode(nextMode);
    close();
  }

  return (
    <PageContainer
      className="page-container--research"
      description={researchHeader.description}
      introAccessory={
        items.length > 0 ? <DetailLevelControl contextLabel="Research" mode={mode} onChange={changeMode} /> : undefined
      }
      introVariant="panel"
      motionEnabled={motionEnabled}
      title={researchHeader.title}
    >
      <div onFocusCapture={onFocusCapture} ref={showcaseRef}>
        <ResearchList
          items={items}
          mode={mode}
          motionEnabled={motionEnabled}
          onToggle={toggle}
          openDetail={openDetail}
          overlayEnabled={!usesNaturalFlow}
        />
      </div>
    </PageContainer>
  );
}
