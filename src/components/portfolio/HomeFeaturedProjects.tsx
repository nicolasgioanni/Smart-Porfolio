import type { ProjectItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { ProjectCard } from "@/components/portfolio/ProjectCard";

export function HomeFeaturedProjects({ items }: { items: ProjectItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="Project highlights will appear here when content is available." />;
  }

  return (
    <FeaturedGrid columns="three" itemCount={items.length}>
      {items.map((item) => (
        <ProjectCard item={item} key={item.id} />
      ))}
    </FeaturedGrid>
  );
}
