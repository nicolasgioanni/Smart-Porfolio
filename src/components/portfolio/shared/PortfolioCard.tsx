import type { ElementType, ReactNode } from "react";
import { GlassCard } from "@/components/glass/GlassCard";

type PortfolioCardVariant = "summary" | "detail" | "compact" | "cta" | "media" | "timeline";

type PortfolioCardProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  id?: string;
  variant?: PortfolioCardVariant;
};

export function PortfolioCard({ as, children, className, id, variant = "summary" }: PortfolioCardProps) {
  return (
    <GlassCard
      as={as}
      className={["portfolio-card", `portfolio-card--${variant}`, className].filter(Boolean).join(" ")}
      density={variant === "compact" ? "compact" : "comfortable"}
      id={id}
    >
      {children}
    </GlassCard>
  );
}
