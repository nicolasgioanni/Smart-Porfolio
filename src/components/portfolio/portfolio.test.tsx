import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GeneratedPortfolioContent, RecommendationItem } from "@/content/types";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { BlobFooter } from "@/components/layout/BlobFooter";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { HomeEducationSummary } from "@/components/portfolio/HomeEducationSummary";
import { HomeRecommendations } from "@/components/portfolio/HomeRecommendations";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { RecommendationsList } from "@/components/portfolio/RecommendationsList";

const recommendation: RecommendationItem = {
  id: "recommendation-a",
  recommenderName: "Alex Manager",
  recommenderTitle: "Engineering Manager",
  recommenderOrganization: "Example Company",
  relationship: "Managed the internship project.",
  recommendationDate: "2025-09",
  source: "LinkedIn",
  sourceUrl: "https://www.linkedin.com/in/example",
  linkedinUrl: "https://www.linkedin.com/in/example/details/recommendations/",
  homeQuote: "A thoughtful engineer who communicates clearly.",
  fullQuote: "A thoughtful engineer who communicates clearly and turns ambiguous product goals into maintainable software.",
  context: "Worked together during a summer internship.",
  skills: ["Communication", "TypeScript"],
  featured: true,
  showOnHome: true,
  homeOrder: 1,
  detailOrder: 1
};

function createFooterContent(repositoryUrl?: string): GeneratedPortfolioContent {
  return {
    metadata: {
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceMode: "templates",
      sources: {}
    },
    profile: {
      fullName: "Nicolas Gioanni",
      headline: "Software engineer",
      location: "City State",
      email: "nicolas@example.com",
      shortBio: "Short bio."
    },
    links: [
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
      },
      {
        id: "resume",
        label: "Resume",
        url: "/resume/demo.pdf",
        kind: "resume",
        isPrimary: false,
        showOnHome: true,
        showInHeader: false,
        showInFooter: true,
        order: 2
      }
    ],
    research: [],
    projects: [],
    experience: [],
    recommendations: [],
    education: [],
    skills: [],
    resume: [],
    siteSettings: {
      siteTitle: "Portfolio",
      siteDescription: "Description",
      defaultTheme: "dark",
      enableSkeletons: true,
      enableScrollMotion: false,
      enableGlassEffects: true,
      enableRecommendations: true,
      showEmptyRecommendations: false,
      maxHomeResearchItems: 2,
      maxHomeProjectItems: 3,
      maxHomeExperienceItems: 3,
      maxHomeRecommendationItems: 1,
      maxHomeSkillItems: 8,
      recommendationsNavLabel: "Recommendations",
      repositoryUrl
    }
  };
}

describe("portfolio UI helpers", () => {
  it("renders accessible empty states", () => {
    render(<EmptyState message="No rows yet." title="Missing content" />);

    expect(screen.getByRole("status")).toHaveTextContent("Missing content");
    expect(screen.getByRole("status")).toHaveTextContent("No rows yet.");
  });

  it("renders education summary content", () => {
    render(
      <HomeEducationSummary
        items={[
          {
            id: "education-a",
            institution: "Example University",
            degree: "BS",
            field: "Computer Science",
            location: "City State",
            startDate: "2022-09",
            endDate: "2026-05",
            homeSummary: "Focused on systems.",
            detailSummary: "Focused on systems and engineering.",
            bullets: ["Algorithms"],
            featured: true,
            showOnHome: true,
            homeOrder: 1,
            detailOrder: 1
          }
        ]}
      />
    );

    expect(screen.getByText("Example University")).toBeInTheDocument();
    expect(screen.getByText(/Focused on systems/)).toBeInTheDocument();
  });

  it("renders recommendation empty and populated states", () => {
    const { rerender } = render(<RecommendationsList items={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("No recommendations yet");

    rerender(<RecommendationsList items={[recommendation]} />);

    expect(screen.getByText("Alex Manager")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on linkedin/i })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Home recommendations concisely with a detail route link", () => {
    render(<HomeRecommendations items={[recommendation]} />);

    expect(screen.getByText("A thoughtful engineer who communicates clearly.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see all recommendations/i })).toHaveAttribute("href", "/recommendations");
  });

  it("renders portfolio-first hero copy without implementation labels", () => {
    const content = createFooterContent();
    render(<PortfolioHero links={content.links} motionEnabled={false} profile={content.profile} />);

    expect(screen.getByRole("heading", { name: "Nicolas Gioanni" })).toBeInTheDocument();
    expect(screen.queryByText(/smart portfolio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/spreadsheet driven/i)).not.toBeInTheDocument();
  });

  it("renders safe rel attributes for external glass icon links", () => {
    render(<GlassIconLink label="GitHub" url="https://github.com/example" />);

    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders generated footer owner and hides missing repository link gracefully", () => {
    render(<BlobFooter content={createFooterContent()} />);

    expect(screen.getByText(/Nicolas Gioanni/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /source available on github/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/built as a static/i)).not.toBeInTheDocument();
  });

  it("renders repository link when provided by site settings", () => {
    render(<BlobFooter content={createFooterContent("https://github.com/example/portfolio")} />);

    expect(screen.getByRole("link", { name: /source available on github/i })).toHaveAttribute("href", "https://github.com/example/portfolio");
  });
});
