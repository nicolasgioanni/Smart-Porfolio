import type { ElementType, ReactNode } from "react";

type GlassCardProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  density?: "comfortable" | "compact";
  id?: string;
};

export function GlassCard({ as: Component = "article", children, className, density = "comfortable", id }: GlassCardProps) {
  return (
    <Component className={["glass-card", `glass-card--${density}`, className].filter(Boolean).join(" ")} id={id}>
      {children}
    </Component>
  );
}
