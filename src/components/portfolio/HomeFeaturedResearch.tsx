import type { ResearchItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { HomeResearchCard } from "@/components/portfolio/HomeResearchCard";

export function HomeFeaturedResearch({ items }: { items: ResearchItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="Research highlights will appear here when content is available." />;
  }

  return (
    <FeaturedGrid columns="three" itemCount={items.length}>
      {items.map((item) => (
        <HomeResearchCard item={item} key={item.id} />
      ))}
    </FeaturedGrid>
  );
}
