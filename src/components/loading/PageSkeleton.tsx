import type { ReactNode } from "react";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";

type PageSkeletonProps = {
  children: ReactNode;
  showHeader?: boolean;
};

export function PageSkeleton({ children, showHeader = true }: PageSkeletonProps) {
  return (
    <section aria-busy="true" aria-label="Loading page" className="skeleton-page">
      {showHeader ? (
        <header className="skeleton-page__header" aria-hidden="true">
          <SkeletonBlock height={54} radius={16} width="42%" />
          <SkeletonBlock height={20} width="78%" />
        </header>
      ) : null}
      {children}
    </section>
  );
}
