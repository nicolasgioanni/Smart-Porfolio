import { SkeletonCard } from "@/components/loading/SkeletonCard";

type SkeletonGridProps = {
  items?: number;
  columns?: "two" | "three";
};

export function SkeletonGrid({ columns = "two", items = 4 }: SkeletonGridProps) {
  return (
    <div className={["skeleton-grid", columns === "three" ? "skeleton-grid--three" : ""].filter(Boolean).join(" ")} aria-hidden="true">
      {Array.from({ length: items }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}