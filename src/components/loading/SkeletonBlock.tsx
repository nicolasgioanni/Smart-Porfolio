import type { CSSProperties } from "react";

type SkeletonDimension = number | string;

export type SkeletonBlockProps = {
  width?: SkeletonDimension;
  height?: SkeletonDimension;
  radius?: SkeletonDimension;
  className?: string;
};

function toCssDimension(value: SkeletonDimension | undefined): string | undefined {
  if (typeof value === "number") return `${value}px`;
  return value;
}

export function SkeletonBlock({ width = "100%", height = 16, radius, className }: SkeletonBlockProps) {
  const style: CSSProperties = {
    width: toCssDimension(width),
    height: toCssDimension(height),
    borderRadius: toCssDimension(radius)
  };

  return <span aria-hidden="true" className={["skeleton-block", className].filter(Boolean).join(" ")} data-testid="skeleton-block" style={style} />;
}
