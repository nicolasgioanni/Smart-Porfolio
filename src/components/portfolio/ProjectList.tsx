import type { ProjectItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { ProjectCard } from "@/components/portfolio/ProjectCard";

type ProjectListProps = {
  items: ProjectItem[];
  variant?: "summary" | "detail";
};

export function ProjectList({ items, variant = "summary" }: ProjectListProps) {
  if (items.length === 0) {
    return <EmptyState message="Project entries will appear here when content is available." />;
  }

  return (
    <FeaturedGrid columns={variant === "detail" ? "two" : "three"}>
      {items.map((item) => (
        <ProjectCard item={item} key={item.id} variant={variant} />
      ))}
    </FeaturedGrid>
  );
}