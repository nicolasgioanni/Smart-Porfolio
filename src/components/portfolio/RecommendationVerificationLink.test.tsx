import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationVerificationLink } from "@/components/portfolio/RecommendationVerificationLink";

const sourceUrl = "https://www.linkedin.com/in/nicolas-gioanni/details/recommendations/";

describe("RecommendationVerificationLink", () => {
  it.each([
    ["summary", "Verified"],
    ["detail", "Verified on LinkedIn"]
  ] as const)("renders the %s variant with safe external-link behavior", (variant, visibleLabel) => {
    const { container } = render(
      <RecommendationVerificationLink recommenderName="Brent Lagesse" sourceUrl={sourceUrl} variant={variant} />
    );

    const link = screen.getByRole("link", {
      name: "View Brent Lagesse's verified recommendation on LinkedIn"
    });
    expect(link).toHaveAttribute("href", sourceUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("recommendation-verification-link", `recommendation-verification-link--${variant}`);

    expect(container.querySelector(".recommendation-verification-link__text")).toHaveTextContent(visibleLabel);
    expect(container.querySelector(".recommendation-verification-link__text")).toHaveAttribute(
      "data-label",
      visibleLabel
    );
    expect(container.querySelector(".recommendation-verification-link__icon")).toHaveAttribute("aria-hidden", "true");
  });
});
