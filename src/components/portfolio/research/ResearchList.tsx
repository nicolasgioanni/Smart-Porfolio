import type { CSSProperties } from "react";
import type { ResearchItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/shared/EmptyState";
import { ResearchCard } from "@/components/portfolio/research/ResearchCard";
import type { DetailMode } from "@/lib/content/detailNarratives";

type ResearchListProps = {
  items: ResearchItem[];
  mode: DetailMode;
  motionEnabled?: boolean;
  onToggle: (itemId: string, sectionId: string) => void;
  openByProject: Record<string, string | undefined>;
};

export function ResearchList({
  items,
  mode,
  motionEnabled = true,
  onToggle,
  openByProject
}: ResearchListProps) {
  if (items.length === 0) {
    return <EmptyState message="Research entries will appear here when content is available." />;
  }

  return (
    <div className="research-list" data-motion={motionEnabled ? "enabled" : "disabled"}>
      {items.map((item, index) => {
        const style = { "--research-order": index } as CSSProperties;

        return (
          <div className="research-project-wrap" key={item.id} style={style}>
            <ResearchCard
              item={item}
              mode={mode}
              onToggle={(sectionId) => onToggle(item.id, sectionId)}
              openSectionId={openByProject[item.id]}
              order={index}
            />
          </div>
        );
      })}
    </div>
  );
}
