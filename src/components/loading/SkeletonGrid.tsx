import { SkeletonCard } from "@/components/loading/SkeletonCard";

type SkeletonGridProps = {
  items?: number;
  columns?: "one" | "two" | "three";
};

export function SkeletonGrid({ columns = "two", items = 4 }: SkeletonGridProps) {
  return (
    <div className={["skeleton-grid", `skeleton-grid--${columns}`].join(" ")} aria-hidden="true">
      {Array.from({ length: items }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
