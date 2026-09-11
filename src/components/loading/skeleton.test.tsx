import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import LoadingContact from "@/app/contact/loading";
import LoadingExperience from "@/app/experience/loading";
import LoadingHome from "@/app/loading";
import LoadingPrivacy from "@/app/privacy/loading";
import LoadingProjects from "@/app/projects/loading";
import LoadingRecommendations from "@/app/recommendations/loading";
import LoadingResearch from "@/app/research/loading";
import LoadingResume from "@/app/resume/loading";
import LoadingSecurity from "@/app/security/loading";
import LoadingTerms from "@/app/terms/loading";
import { HomePageSkeleton } from "@/components/loading/HomePageSkeleton";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { RouteSkeleton, routeSkeletons, skeletonRoutePaths } from "@/components/loading/RouteSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutePaths, type SiteRoutePath } from "@/components/navigation/siteRoutes";

const routeLoadingComponents = {
  "/": LoadingHome,
  "/experience": LoadingExperience,
  "/research": LoadingResearch,
  "/projects": LoadingProjects,
  "/recommendations": LoadingRecommendations,
  "/resume": LoadingResume,
  "/contact": LoadingContact,
  "/terms": LoadingTerms,
  "/privacy": LoadingPrivacy,
  "/security": LoadingSecurity
} as const satisfies Readonly<Record<SiteRoutePath, ComponentType>>;

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
    expect(container.querySelectorAll(".home-skeleton__skill-group")).toHaveLength(3);
  });

  it("renders one combined Experience intro skeleton without a separate page header", () => {
    const { container } = render(<LoadingExperience />);

    expect(container.querySelectorAll(".experience-skeleton__intro")).toHaveLength(1);
    expect(container.querySelector(".experience-skeleton__intro-copy")).toBeInTheDocument();
    expect(container.querySelector(".experience-skeleton__intro-control")).toBeInTheDocument();
    expect(container.querySelectorAll(".experience-skeleton__card")).toHaveLength(5);
    expect(container.querySelector(".skeleton-page__header")).not.toBeInTheDocument();
  });

  it("covers every declared route with a local loading boundary and registered composition", () => {
    expect(skeletonRoutePaths).toEqual(siteRoutePaths);
    expect(Object.keys(routeSkeletons)).toEqual(siteRoutePaths);
    expect(Object.keys(routeLoadingComponents)).toEqual(siteRoutePaths);

    for (const pathname of siteRoutePaths) {
      const Component = routeLoadingComponents[pathname];
      const { unmount } = render(<Component />);
      const loadingPage = screen.getByLabelText("Loading page");

      expect(screen.getByTestId(`loading-boundary-${pathname}`)).toBeInTheDocument();
      expect(loadingPage).toHaveClass("skeleton-page");
      expect(loadingPage).not.toHaveClass("page-container");
      unmount();
    }
  });

  it("keeps the shared legal composition aligned across all legal routes", () => {
    for (const pathname of ["/terms", "/privacy", "/security"] as const) {
      const { container, unmount } = render(<RouteSkeleton pathname={pathname} />);

      expect(container.querySelector(".skeleton-page--legal")).toBeInTheDocument();
      expect(container.querySelector(".legal-skeleton")).toBeInTheDocument();
      expect(container.querySelectorAll(".legal-skeleton__section")).toHaveLength(6);
      unmount();
    }
  });

  it("uses route-local geometry for the interactive page bodies", () => {
    const { container, rerender } = render(<RouteSkeleton pathname="/contact" />);
    expect(container.querySelector(".contact-skeleton__gate")).toBeInTheDocument();
    expect(container.querySelector(".contact-skeleton__verification-well")).toHaveStyle({ height: "136px" });
    expect(container.querySelector(".contact-skeleton__progress")).not.toBeInTheDocument();
    expect(container.querySelector(".contact-skeleton__fallback")).toBeInTheDocument();

    rerender(<RouteSkeleton pathname="/projects" />);
    expect(container.querySelectorAll(".detail-card-skeleton--project")).toHaveLength(3);

    rerender(<RouteSkeleton pathname="/recommendations" />);
    expect(container.querySelectorAll(".detail-card-skeleton--recommendation")).toHaveLength(4);

    rerender(<RouteSkeleton pathname="/resume" />);
    expect(container.querySelector(".resume-skeleton__actions")).toBeInTheDocument();
  });
});
