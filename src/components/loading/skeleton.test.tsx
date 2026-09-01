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
import { experienceSkeletonProfiles } from "@/components/loading/ExperiencePageSkeleton";
import { HomePageSkeleton } from "@/components/loading/HomePageSkeleton";
import { legalSkeletonProfiles } from "@/components/loading/LegalPageSkeleton";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { projectSkeletonProfiles } from "@/components/loading/projectSkeletonProfiles";
import { researchSkeletonProfiles } from "@/components/loading/ResearchPageSkeleton";
import { RouteHeaderSkeleton } from "@/components/loading/RouteHeaderSkeleton";
import { RouteSkeleton, routeSkeletons, skeletonRoutePaths } from "@/components/loading/RouteSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutePaths, type SiteRoutePath } from "@/components/navigation/siteRoutes";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { getResearchFormalTitle } from "@/lib/content/researchNarratives";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";
import { selectResearchDetailContent } from "@/lib/content/selectHomeContent";

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
      <PageSkeleton pathname="/projects">
        <SkeletonBlock />
      </PageSkeleton>
    );

    expect(screen.getByLabelText("Loading page")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Loading page").querySelector(".route-header-skeleton__ink")).toBeInTheDocument();
  });

  it("renders Home page skeleton without real content text", () => {
    const { container } = render(<HomePageSkeleton />);

    expect(container.textContent).toBe("");
    expect(container.querySelectorAll(".home-skeleton__skill-group")).toHaveLength(3);
    expect(container.querySelector(".home-skeleton__portrait-column")).toContainElement(
      container.querySelector(".home-skeleton__portrait")
    );
    expect(Array.from(container.querySelectorAll("[data-skeleton-section]")).map((section) => section.getAttribute("data-skeleton-section"))).toEqual([
      "experience",
      "education",
      "research",
      "projects",
      "skills",
      "recommendations"
    ]);
    expect(container.querySelectorAll('[data-skeleton-section="education"] .home-skeleton__row')).toHaveLength(1);
    expect(container.querySelectorAll(".home-skeleton__identity-list > .skeleton-block")).toHaveLength(5);
    expect(
      Array.from(container.querySelectorAll(".home-skeleton__experience-group")).map(
        (group) => group.querySelectorAll(".home-skeleton__experience-role").length
      )
    ).toEqual([1, 2, 2]);
  });

  it("renders one combined Experience intro skeleton without a separate page header", () => {
    const { container } = render(<LoadingExperience />);

    expect(container.querySelectorAll(".experience-skeleton__intro")).toHaveLength(1);
    expect(container.querySelector(".experience-skeleton__intro-copy")).toBeInTheDocument();
    expect(container.querySelector(".experience-skeleton__intro-control")).toBeInTheDocument();
    expect(container.querySelector(".experience-skeleton__intro-copy .route-header-skeleton__title")).toBeInTheDocument();
    expect(container.querySelectorAll(".experience-skeleton__card")).toHaveLength(5);
    expect(container.querySelectorAll(".experience-skeleton__chapters")).toHaveLength(5);
    expect(
      Array.from(container.querySelectorAll(".experience-skeleton__chapters")).map(
        (chapters) => chapters.querySelectorAll(":scope > .skeleton-block").length
      )
    ).toEqual([0, 4, 4, 4, 4]);
    expect(experienceSkeletonProfiles.map((profile) => profile.overviewRows)).toEqual([0, 4, 4, 4, 4]);
    expect(container.querySelector(".skeleton-page__header")).not.toBeInTheDocument();
  });

  it("keeps the custom Research intro title footprint aligned with shared page headings", () => {
    const { container } = render(<LoadingResearch />);

    expect(container.querySelector(".research-skeleton__intro-copy .route-header-skeleton__title")).toBeInTheDocument();
    expect(container.querySelectorAll(".research-skeleton__project")).toHaveLength(3);
    expect(
      Array.from(container.querySelectorAll(".research-skeleton__project")).map(
        (project) => project.querySelectorAll(".research-skeleton__details > .skeleton-block").length
      )
    ).toEqual([4, 3, 3]);
    expect(container.querySelectorAll(".research-skeleton__video-actions > .skeleton-block")).toHaveLength(3);
    expect(container.querySelectorAll(".research-skeleton__media-stack")).toHaveLength(1);
    expect(container.querySelectorAll(".research-skeleton__abstract-frame")).toHaveLength(3);
    expect(
      Array.from(container.querySelectorAll(".research-skeleton__resources")).map(
        (resources) => resources.querySelectorAll(":scope > .skeleton-block").length
      )
    ).toEqual([4, 3, 1]);
    expect(container.querySelectorAll("[role=dialog]")).toHaveLength(0);
  });

  it("uses one exhaustive loader-safe header registry and hides canonical ink from assistive technology", () => {
    expect(Object.keys(routeHeaderContent)).toEqual(siteRoutePaths);
    expect(routeHeaderContent["/"]).toBeNull();
    expect(routeHeaderContent["/experience"]).toMatchObject({ accessory: "detail-level", placement: "embedded", title: "Experience" });
    expect(routeHeaderContent["/research"]).toMatchObject({ accessory: "detail-level", placement: "embedded", title: "Applied AI Research" });
    expect(routeHeaderContent["/terms"].eyebrow).toBe("Site notice");

    const { container } = render(<RouteHeaderSkeleton pathname="/security" />);
    const skeleton = container.querySelector(".route-header-skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton?.querySelectorAll("a, button, input, select, textarea, [tabindex]")).toHaveLength(0);
    expect(skeleton?.querySelector(".route-header-skeleton__ink")).toHaveTextContent("Site notice");
  });

  it("uses the validated Experience summary override in both resolved and loading header copy", () => {
    const override = { profile: { experienceSummary: "A distinct, valid Experience summary used only for this server render." } };
    const { container } = render(
      <>
        <SectionHeader description={override.profile.experienceSummary} headingLevel="h1" title="Experience" variant="page" />
        <RouteHeaderSkeleton content={override} pathname="/experience" />
      </>
    );

    expect(container.querySelector(".section-header:not(.route-header-skeleton) .page-description")).toHaveTextContent(
      override.profile.experienceSummary
    );
    expect(container.querySelector(".route-header-skeleton__description .route-header-skeleton__ink")).toHaveTextContent(
      override.profile.experienceSummary
    );
  });

  it("renders project and research cards from their typed literal profiles", () => {
    expect(projectSkeletonProfiles.map((profile) => profile.chipWidths)).toEqual([
      [60, 78, 59, 54, 90, 82, 70, 70, 86, 62],
      [66, 59, 82, 40, 54, 82],
      [59, 102, 100, 44, 54]
    ]);
    expect(projectSkeletonProfiles.map((profile) => profile.actionWidths)).toEqual([[112, 96], [112], [112]]);
    expect(researchSkeletonProfiles.map((profile) => profile.formalTitle)).toEqual(
      selectResearchDetailContent(getPortfolioContent()).map((item) => Boolean(getResearchFormalTitle(item)))
    );
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
    const expectedLegalContentShapes = {
      "/terms": [
        ["paragraph", "paragraph"],
        ["paragraph", "paragraph", "paragraph"],
        ["paragraph", "paragraph"],
        ["paragraph"],
        ["paragraph", "paragraph"],
        ["paragraph"],
        ["paragraph"]
      ],
      "/privacy": [
        ["paragraph", "paragraph", "paragraph"],
        ["paragraph", "paragraph", "paragraph"],
        ["paragraph"],
        ["paragraph", "paragraph", "paragraph", "paragraph", "paragraph", "paragraph", "paragraph", "paragraph", "paragraph"],
        ["paragraph", "paragraph"],
        ["paragraph", "paragraph", "paragraph"],
        ["paragraph"],
        ["paragraph"]
      ],
      "/security": [
        ["paragraph", "paragraph", "paragraph"],
        ["paragraph", "paragraph", "paragraph", "paragraph", "paragraph", "paragraph"],
        ["paragraph", "list", "paragraph"],
        ["paragraph", "list", "paragraph"],
        ["paragraph"],
        ["paragraph"],
        ["paragraph"]
      ]
    } as const;
    const expectedListItemCounts = {
      "/terms": [],
      "/privacy": [],
      "/security": [4, 6]
    } as const;
    const expectedParagraphRowTotals = {
      "/terms": [5, 8, 8, 3, 7, 4, 2],
      "/privacy": [9, 15, 5, 51, 6, 16, 5, 3],
      "/security": [13, 34, 4, 4, 3, 3, 2]
    } as const;
    const expectedListItemRows = {
      "/terms": [],
      "/privacy": [],
      "/security": [
        [1, 2, 1, 2],
        [1, 2, 2, 2, 2, 3]
      ]
    } as const;

    expect(Object.keys(legalSkeletonProfiles)).toEqual(Object.keys(expectedLegalContentShapes));

    for (const pathname of ["/terms", "/privacy", "/security"] as const) {
      const profile = legalSkeletonProfiles[pathname];
      const { container, unmount } = render(<RouteSkeleton pathname={pathname} />);
      const renderedSections = Array.from(container.querySelectorAll(".legal-skeleton__section"));

      expect(container.querySelector(".skeleton-page--legal")).toBeInTheDocument();
      expect(container.querySelector(".legal-skeleton")).toBeInTheDocument();
      expect(routeSkeletons[pathname]).toBeDefined();
      expect(profile.map((section) => section.content.map((block) => block.type))).toEqual(
        expectedLegalContentShapes[pathname]
      );
      expect(
        profile.map((section) =>
          section.content.reduce((total, block) => total + (block.type === "paragraph" ? block.rows : 0), 0)
        )
      ).toEqual(expectedParagraphRowTotals[pathname]);
      expect(
        profile.flatMap((section) => section.content.filter((block) => block.type === "list").map((block) => block.itemRows))
      ).toEqual(expectedListItemRows[pathname]);
      expect(renderedSections).toHaveLength(expectedLegalContentShapes[pathname].length);
      expect(
        renderedSections.map((section) => section.querySelectorAll(":scope > .legal-skeleton__content > .skeleton-text").length)
      ).toEqual(profile.map((section) => section.content.filter((block) => block.type === "paragraph").length));
      expect(
        renderedSections
          .flatMap((section) => Array.from(section.querySelectorAll(":scope > .legal-skeleton__content > .legal-skeleton__list")))
          .map((list) => list.querySelectorAll(".legal-skeleton__list-item").length)
      ).toEqual(expectedListItemCounts[pathname]);
      unmount();
    }
  });

  it("uses route-local geometry for the interactive page bodies", () => {
    const { container, rerender } = render(<RouteSkeleton pathname="/contact" />);
    expect(container.querySelector(".skeleton-page__header .route-header-skeleton__ink")).toHaveTextContent("Contact");
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
