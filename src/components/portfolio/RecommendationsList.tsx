import type { RecommendationItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { RecommendationCard } from "@/components/portfolio/RecommendationCard";

export function RecommendationsList({ items }: { items: RecommendationItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="Professional recommendations will appear here when spreadsheet rows are available." title="No recommendations yet" />;
  }

  return (
    <FeaturedGrid columns="two">
      {items.map((item) => (
        <RecommendationCard item={item} key={item.id} />
      ))}
    </FeaturedGrid>
  );
}
