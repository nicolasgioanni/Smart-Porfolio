import type { ResearchItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { ResearchCard } from "@/components/portfolio/ResearchCard";

type ResearchListProps = {
  items: ResearchItem[];
  variant?: "summary" | "detail";
};

export function ResearchList({ items, variant = "summary" }: ResearchListProps) {
  if (items.length === 0) {
    return <EmptyState message="Research entries will appear here when content is available." />;
  }

  return (
    <FeaturedGrid columns="two" itemCount={items.length}>
      {items.map((item) => (
        <ResearchCard item={item} key={item.id} variant={variant} />
      ))}
    </FeaturedGrid>
  );
}
