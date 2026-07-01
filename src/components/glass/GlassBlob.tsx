import type { ElementType, ReactNode } from "react";

type GlassBlobProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  tone?: "nav" | "footer" | "panel";
};

export function GlassBlob({ as: Component = "div", children, className, tone = "panel" }: GlassBlobProps) {
  return <Component className={["glass-blob", `glass-blob--${tone}`, className].filter(Boolean).join(" ")}>{children}</Component>;
}