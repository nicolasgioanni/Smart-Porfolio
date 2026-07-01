"use client";

import type { ElementType, ReactNode } from "react";
import { useIntersectionMotion } from "@/components/motion/useIntersectionMotion";

type CompressOnScrollSectionProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  enabled?: boolean;
};

export function CompressOnScrollSection({ as: Component = "section", children, className, enabled = true }: CompressOnScrollSectionProps) {
  const { ref, visible } = useIntersectionMotion<HTMLElement>({ enabled, rootMargin: "-8% 0px -18% 0px", threshold: 0.1 });

  if (!enabled) {
    return <Component className={className}>{children}</Component>;
  }

  return (
    <Component className={["motion-compress", visible ? "is-visible" : "", className].filter(Boolean).join(" ")} ref={ref}>
      {children}
    </Component>
  );
}
