import type { ExperienceItem } from "@/content/types";
import { ExperienceTimeline } from "@/components/portfolio/ExperienceTimeline";

type ExperienceListProps = {
  items: ExperienceItem[];
  variant?: "summary" | "detail";
};

export function ExperienceList({ items, variant = "summary" }: ExperienceListProps) {
  return <ExperienceTimeline items={items} variant={variant} />;
}