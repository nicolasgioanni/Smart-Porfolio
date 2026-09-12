import type { ExperienceItem } from "@/content/types";
import { ExperienceTimeline } from "@/components/portfolio/experience/ExperienceTimeline";

type ExperienceListProps = {
  items: ExperienceItem[];
  variant?: "summary" | "detail";
};

export function ExperienceList({ items, variant = "summary" }: ExperienceListProps) {
  return <ExperienceTimeline items={items} variant={variant} />;
}