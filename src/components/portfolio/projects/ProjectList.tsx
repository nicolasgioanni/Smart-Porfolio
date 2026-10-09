import type { ProjectItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/shared/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/shared/FeaturedGrid";
import { ProjectCard } from "@/components/portfolio/projects/ProjectCard";

type ProjectListProps = {
  items: ProjectItem[];
  staticVisual?: boolean;
  variant?: "summary" | "detail";
};

export function ProjectList({ items, staticVisual = false, variant = "summary" }: ProjectListProps) {
  if (items.length === 0) {
    return <EmptyState message="Project entries will appear here when content is available." />;
  }

  return (
    <FeaturedGrid columns={variant === "detail" ? "two" : "three"} itemCount={items.length}>
      {items.map((item) => (
        <ProjectCard item={item} key={item.id} staticVisual={staticVisual} variant={variant} />
      ))}
    </FeaturedGrid>
  );
}
