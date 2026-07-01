import type { ResearchItem } from "@/content/types";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { ResearchCard } from "@/components/portfolio/ResearchCard";
import { EmptyState } from "@/components/portfolio/EmptyState";

export function HomeFeaturedResearch({ items }: { items: ResearchItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="Research highlights will appear here when spreadsheet rows are available." />;
  }

  return (
    <FeaturedGrid columns="two">
      {items.map((item) => (
        <ResearchCard item={item} key={item.id} />
      ))}
    </FeaturedGrid>
  );
}