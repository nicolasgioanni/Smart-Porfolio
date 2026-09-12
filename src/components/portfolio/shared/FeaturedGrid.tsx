import type { ReactNode } from "react";

type FeaturedGridProps = {
  children: ReactNode;
  columns?: "two" | "three";
  itemCount?: number;
};

export function FeaturedGrid({ children, columns = "two", itemCount }: FeaturedGridProps) {
  return (
    <div className={["featured-grid", `featured-grid--${columns}`, itemCount === 1 ? "featured-grid--single" : null].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
