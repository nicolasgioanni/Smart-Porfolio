import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingExperience from "@/app/experience/loading";
import LoadingHome from "@/app/loading";
import LoadingProjects from "@/app/projects/loading";
import LoadingRecommendations from "@/app/recommendations/loading";
import LoadingResearch from "@/app/research/loading";
import LoadingResume from "@/app/resume/loading";
import { HomePageSkeleton } from "@/components/loading/HomePageSkeleton";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";

describe("skeleton components", () => {
  it("renders block shapes without content text", () => {
    const { container } = render(<SkeletonText rows={3} />);

    expect(container.textContent).toBe("");
    expect(screen.getAllByTestId("skeleton-block")).toHaveLength(3);
  });

  it("sets aria-hidden on primitive skeleton blocks", () => {
    render(<SkeletonBlock />);

    expect(screen.getByTestId("skeleton-block")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders page skeleton structure with loading state", () => {
    render(
      <PageSkeleton>
        <SkeletonBlock />
      </PageSkeleton>
    );

    expect(screen.getByLabelText("Loading page")).toHaveAttribute("aria-busy", "true");
  });

  it("renders Home page skeleton without real content text", () => {
    const { container } = render(<HomePageSkeleton />);

    expect(container.textContent).toBe("");
  });

  it("route loading files render page skeletons", () => {
    const components = [LoadingHome, LoadingResearch, LoadingProjects, LoadingExperience, LoadingRecommendations, LoadingResume];

    for (const Component of components) {
      const { unmount } = render(<Component />);
      expect(screen.getByLabelText("Loading page")).toBeInTheDocument();
      unmount();
    }
  });
});
