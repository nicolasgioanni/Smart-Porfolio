"use client";

import type { ElementType, ReactNode } from "react";
import { useIntersectionMotion } from "@/components/motion/useIntersectionMotion";

type ScrollRevealProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  delay?: "none" | "short" | "medium";
  enabled?: boolean;
};

export function ScrollReveal({ as: Component = "div", children, className, delay = "none", enabled = true }: ScrollRevealProps) {
  const { ref, visible } = useIntersectionMotion<HTMLElement>({ enabled });

  if (!enabled) {
    return <Component className={className}>{children}</Component>;
  }

  return (
    <Component
      className={["motion-reveal", `motion-reveal--delay-${delay}`, visible ? "is-visible" : "", className]
        .filter(Boolean)
        .join(" ")}
      ref={ref}
    >
      {children}
    </Component>
  );
}
