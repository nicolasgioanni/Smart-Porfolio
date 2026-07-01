import { SkeletonBlock } from "@/components/loading/SkeletonBlock";

type SkeletonTextProps = {
  rows?: number;
  widths?: Array<number | string>;
};

export function SkeletonText({ rows = 3, widths = [] }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className="skeleton-text">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock height={14} key={index} width={widths[index] ?? (index === rows - 1 ? "72%" : "100%")} />
      ))}
    </div>
  );
}
