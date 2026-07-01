import type { ElementType, ReactNode } from "react";

type GlassCardProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  density?: "comfortable" | "compact";
};

export function GlassCard({ as: Component = "article", children, className, density = "comfortable" }: GlassCardProps) {
  return <Component className={["glass-card", `glass-card--${density}`, className].filter(Boolean).join(" ")}>{children}</Component>;
}