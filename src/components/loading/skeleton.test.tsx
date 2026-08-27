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
import { legalSkeletonProfiles } from "@/components/loading/LegalPageSkeleton";
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
    expect(screen.getAllByTestId("skeleton-block")[0]).toHaveStyle({ height: "34px" });
  });

  it("renders Home page skeleton without real content text", () => {
    const { container } = render(<HomePageSkeleton />);

    expect(container.textContent).toBe("");
    expect(container.querySelectorAll(".home-skeleton__skill-group")).toHaveLength(3);
    expect(Array.from(container.querySelectorAll("[data-skeleton-section]")).map((section) => section.getAttribute("data-skeleton-section"))).toEqual([
      "experience",
      "education",
      "research",
      "projects",
      "skills",
      "recommendations"
    ]);
    expect(container.querySelectorAll('[data-skeleton-section="education"] .home-skeleton__row')).toHaveLength(1);
  });

  it("renders one combined Experience intro skeleton without a separate page header", () => {
    const { container } = render(<LoadingExperience />);

    expect(container.querySelectorAll(".experience-skeleton__intro")).toHaveLength(1);
    expect(container.querySelector(".experience-skeleton__intro-copy")).toBeInTheDocument();
    expect(container.querySelector(".experience-skeleton__intro-control")).toBeInTheDocument();
    expect(container.querySelector(".experience-skeleton__intro-copy .skeleton-block")).toHaveStyle({ height: "44px" });
    expect(container.querySelectorAll(".experience-skeleton__card")).toHaveLength(5);
    expect(container.querySelector(".skeleton-page__header")).not.toBeInTheDocument();
  });

  it("keeps the custom Research intro title footprint independent from generic page headings", () => {
    const { container } = render(<LoadingResearch />);

    expect(container.querySelector(".research-skeleton__intro-copy .skeleton-block")).toHaveStyle({ height: "44px" });
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

  it("keeps shared legal sections route-faithful through registered row profiles", () => {
    const expectedSectionCounts = {
      "/terms": 7,
      "/privacy": 8,
      "/security": 7
    } as const;

    expect(Object.keys(legalSkeletonProfiles)).toEqual(Object.keys(expectedSectionCounts));

    for (const [pathname, expectedSectionCount] of Object.entries(expectedSectionCounts) as [
      keyof typeof expectedSectionCounts,
      number
    ][]) {
      const { container, unmount } = render(<RouteSkeleton pathname={pathname} />);

      expect(container.querySelector(".skeleton-page--legal")).toBeInTheDocument();
      expect(container.querySelector(".legal-skeleton")).toBeInTheDocument();
      expect(routeSkeletons[pathname]).toBeDefined();
      expect(legalSkeletonProfiles[pathname]).toHaveLength(expectedSectionCount);
      expect(container.querySelectorAll(".legal-skeleton__section")).toHaveLength(expectedSectionCount);
      expect(
        Array.from(container.querySelectorAll(".legal-skeleton__section .skeleton-text")).map(
          (section) => section.querySelectorAll(".skeleton-block").length
        )
      ).toEqual(legalSkeletonProfiles[pathname].map((section) => section.rows));
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
