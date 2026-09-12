import type { ProjectItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/shared/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/shared/FeaturedGrid";
import { HomeProjectCard } from "@/components/portfolio/home/HomeProjectCard";

export function HomeFeaturedProjects({ items }: { items: ProjectItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="Project highlights will appear here when content is available." />;
  }

  return (
    <FeaturedGrid columns="three" itemCount={items.length}>
      {items.map((item) => (
        <HomeProjectCard item={item} key={item.id} />
      ))}
    </FeaturedGrid>
  );
}
