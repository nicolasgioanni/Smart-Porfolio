import type { ExperienceItem } from "@/content/types";
import { ExperienceTimeline } from "@/components/portfolio/ExperienceTimeline";

export function HomeFeaturedExperience({ items }: { items: ExperienceItem[] }) {
  return <ExperienceTimeline items={items} variant="summary" />;
}