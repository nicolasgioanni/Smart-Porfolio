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
          <SkeletonBlock height={13} width={120} />
          <SkeletonBlock height={74} radius={24} width="68%" />
          <SkeletonBlock height={20} width="78%" />
        </header>
      ) : null}
      {children}
    </section>
  );
}