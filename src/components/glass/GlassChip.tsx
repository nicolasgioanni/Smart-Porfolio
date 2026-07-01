import type { ReactNode } from "react";

type GlassChipProps = {
  children: ReactNode;
  tone?: "default" | "accent" | "muted";
};

export function GlassChip({ children, tone = "default" }: GlassChipProps) {
  return <span className={["glass-chip", `glass-chip--${tone}`].join(" ")}>{children}</span>;
}