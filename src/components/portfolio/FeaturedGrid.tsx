import type { ReactNode } from "react";

type FeaturedGridProps = {
  children: ReactNode;
  columns?: "two" | "three";
};

export function FeaturedGrid({ children, columns = "two" }: FeaturedGridProps) {
  return <div className={["featured-grid", `featured-grid--${columns}`].join(" ")}>{children}</div>;
}