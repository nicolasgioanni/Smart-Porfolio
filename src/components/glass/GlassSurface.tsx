import type { ElementType, ReactNode } from "react";

type GlassSurfaceProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  variant?: "default" | "strong" | "subtle";
};

export function GlassSurface({ as: Component = "div", children, className, variant = "default" }: GlassSurfaceProps) {
  return <Component className={["glass-surface", `glass-surface--${variant}`, className].filter(Boolean).join(" ")}>{children}</Component>;
}