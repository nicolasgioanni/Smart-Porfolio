import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecommendationItem } from "@/content/types";
import { RecommendationCard } from "@/components/portfolio/recommendations/RecommendationCard";

const billyRecommendation: RecommendationItem = {
  id: "billy-gardner-mcintyre",
  recommenderName: "Billy Gardner McIntyre",
  recommenderTitle: "AI Engineer",
  recommenderOrganization: "U.S. Department of the Treasury",
  relationship: "Mentored Nicolas",
  recommendationDate: "2026-10-05",
  source: "LinkedIn",
  sourceUrl: "https://www.linkedin.com/in/nicolas-gioanni/details/recommendations/",
  linkedinUrl: "https://www.linkedin.com/in/bgmcintyre",
  fullQuote:
    "Nicolas was already a highly skilled engineer when I met him, clearly immersed in the latest agentic coding practices and enthusiastic about learning more. He exhibited a great passion for building useful software and taking an active interest in stakeholders' needs. I highly recommend him for software engineering roles, especially any for which clear communication is a necessity.",
  skills: [],
  featured: false,
  showOnHome: true,
  homeOrder: 1,
  detailOrder: 1
};

const currentRecommendationIds = [
  "billy-gardner-mcintyre",
  "brent-lagesse",
  "annuska-zolyomi",
  "anoop-prasad",
  "minh-nhat-huynh"
] as const;

function createRecommendation(
  id: string,
  overrides: Partial<RecommendationItem> = {}
): RecommendationItem {
  return {
    ...billyRecommendation,
    id,
    recommenderName: "Taylor Recommender",
    linkedinUrl: "https://www.linkedin.com/in/taylor-recommender/",
    ...overrides
  };
}

describe("RecommendationCard", () => {
  it("renders Billy's attributed recommendation with safe LinkedIn destinations and no avatar field", () => {
    const { container } = render(<RecommendationCard item={billyRecommendation} />);

    expect(screen.getByRole("heading", { name: "Billy Gardner McIntyre" })).toBeInTheDocument();
    expect(screen.getByText("AI Engineer at U.S. Department of the Treasury")).toBeInTheDocument();
    expect(screen.getByText("October 5, 2026")).toBeInTheDocument();
    expect(screen.getByText("Mentored Nicolas")).toBeInTheDocument();
    expect(container.querySelector("blockquote")).toHaveTextContent(billyRecommendation.fullQuote);
    expect(container.querySelector("img")).not.toBeInTheDocument();

    const profile = screen.getByRole("link", { name: "View Billy Gardner McIntyre's LinkedIn profile" });
    const recommendation = screen.getByRole("link", {
      name: "View Billy Gardner McIntyre's recommendation on LinkedIn"
    });

    expect(profile).toHaveAttribute("href", billyRecommendation.linkedinUrl);
    expect(recommendation).toHaveAttribute("href", billyRecommendation.sourceUrl);
    for (const link of [profile, recommendation]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(within(container).getByRole("link", { name: /verified recommendation on linkedin/i })).toHaveAttribute(
      "href",
      billyRecommendation.sourceUrl
    );
  });

  it.each(currentRecommendationIds)(
    "uses the shared recommendation-page fallback for the current %s record when source data is absent or duplicates the profile",
    (id) => {
      const profileUrl = "https://www.linkedin.com/in/taylor-recommender/";

      const { rerender } = render(<RecommendationCard item={createRecommendation(id, { sourceUrl: undefined })} />);
      expect(screen.getByRole("link", { name: /verified recommendation on linkedin/i })).toHaveAttribute(
        "href",
        "https://www.linkedin.com/in/nicolas-gioanni/details/recommendations/"
      );
      expect(screen.getByRole("link", { name: /view taylor recommender's recommendation on linkedin/i })).toHaveAttribute(
        "href",
        "https://www.linkedin.com/in/nicolas-gioanni/details/recommendations/"
      );

      rerender(<RecommendationCard item={createRecommendation(id, { sourceUrl: profileUrl })} />);
      expect(screen.getByRole("link", { name: /verified recommendation on linkedin/i })).toHaveAttribute(
        "href",
        "https://www.linkedin.com/in/nicolas-gioanni/details/recommendations/"
      );
    }
  );

  it("keeps a distinct explicit source and does not invent verification links for future records", () => {
    const explicitSourceUrl = "https://www.linkedin.com/posts/taylor-recommender/";
    const { rerender } = render(
      <RecommendationCard item={createRecommendation("future-recommender", { sourceUrl: explicitSourceUrl })} />
    );

    expect(screen.getByRole("link", { name: /verified recommendation on linkedin/i })).toHaveAttribute(
      "href",
      explicitSourceUrl
    );
    expect(screen.getByRole("link", { name: /view taylor recommender's recommendation on linkedin/i })).toHaveAttribute(
      "href",
      explicitSourceUrl
    );

    rerender(
      <RecommendationCard
        item={createRecommendation("future-recommender", {
          sourceUrl: "https://www.linkedin.com/in/taylor-recommender/"
        })}
      />
    );
    expect(screen.queryByRole("link", { name: /verified recommendation on linkedin/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /view taylor recommender's recommendation on linkedin/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view taylor recommender's linkedin profile/i })).toBeInTheDocument();
  });
});
