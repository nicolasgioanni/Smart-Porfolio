import type { ExperienceItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { ExperienceTimelineItem } from "@/components/portfolio/ExperienceTimelineItem";

export function ExperienceTimeline({ items, variant = "detail" }: { items: ExperienceItem[]; variant?: "summary" | "detail" }) {
  if (items.length === 0) {
    return <EmptyState message="Experience entries will appear here when content is available." />;
  }

  return (
    <div className="experience-timeline">
      {items.map((item) => (
        <ExperienceTimelineItem item={item} key={item.id} variant={variant} />
      ))}
    </div>
  );
}