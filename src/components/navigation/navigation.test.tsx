import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialLinkGroup } from "@/components/navigation/SocialLinkGroup";
import { createNavigationItems, isNavigationItemActive, navigationItems } from "@/components/navigation/navigationItems";

describe("navigation helpers", () => {
  it("generates the required route links", () => {
    expect(navigationItems.map((item) => item.href)).toEqual(["/", "/research", "/projects", "/experience", "/recommendations", "/resume"]);
  });

  it("supports content-driven recommendations navigation settings", () => {
    expect(createNavigationItems({ enableRecommendations: false, recommendationsNavLabel: "Recommendations" }).map((item) => item.href)).toEqual([
      "/",
      "/research",
      "/projects",
      "/experience",
      "/resume"
    ]);
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 0 }).map((item) => item.href)).toEqual([
      "/",
      "/research",
      "/projects",
      "/experience",
      "/resume"
    ]);
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 0, showEmptyRecommendations: true }).map((item) => item.href)).toContain(
      "/recommendations"
    );
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 1, recommendationsNavLabel: "References" }).find((item) => item.href === "/recommendations")?.label).toBe("References");
  });

  it("detects active routes", () => {
    expect(isNavigationItemActive("/projects", "/projects")).toBe(true);
    expect(isNavigationItemActive("/projects/demo", "/projects")).toBe(true);
    expect(isNavigationItemActive("/research", "/")).toBe(false);
  });

  it("renders descriptive social links", () => {
    render(
      <SocialLinkGroup
        links={[
          {
            id: "github",
            label: "GitHub",
            url: "https://github.com/example",
            kind: "github",
            isPrimary: true,
            showOnHome: true,
            showInHeader: true,
            showInFooter: true,
            order: 1
          }
        ]}
      />
    );

    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("href", "https://github.com/example");
  });
});
