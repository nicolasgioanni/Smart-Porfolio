import type { ReactNode } from "react";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";

type PageSkeletonProps = {
  children: ReactNode;
  headerVariant?: "default" | "legal";
  showHeader?: boolean;
  variant?: "default" | "home" | "legal" | "contact";
};

export function PageSkeleton({
  children,
  headerVariant = "default",
  showHeader = true,
  variant = "default"
}: PageSkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading page"
      className={["skeleton-page", `skeleton-page--${variant}`].join(" ")}
    >
      {showHeader ? (
        <header className="skeleton-page__header" aria-hidden="true">
          {headerVariant === "legal" ? <SkeletonBlock height={12} width={112} /> : null}
          <SkeletonBlock height={52} radius={14} width="min(100%, 460px)" />
          <SkeletonBlock height={20} width="min(100%, 760px)" />
          <SkeletonBlock height={20} width="min(74%, 580px)" />
        </header>
      ) : null}
      {children}
    </section>
  );
}
