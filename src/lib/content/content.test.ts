import { describe, expect, it } from "vitest";
import type { GeneratedContentMetadata } from "@/content/types";
import { parseCsv } from "@/lib/csv/parseCsv";
import {
  normalizeBoolean,
  normalizeLinkList,
  normalizeNumber,
  normalizePipeDelimitedList,
  normalizePortfolioContent,
  type RawPortfolioSheets
} from "@/lib/content/normalizePortfolioContent";
import {
  createRecommendationExcerpt,
  groupSkillsByCategory,
  hasRecommendations,
  selectHomeContent,
  selectHomeRecommendations,
  shouldShowRecommendationsRoute
} from "@/lib/content/selectHomeContent";
import { sortForDetail, sortForHome, sortRecommendationsForDetail } from "@/lib/content/sortPortfolioContent";
import { isHttpsUrl, isSupportedUrl } from "@/lib/content/validatePortfolioContent";
import { formatDateRange } from "@/lib/formatting/formatDateRange";

const metadata: GeneratedContentMetadata = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  sourceMode: "templates",
  sources: {
    profile: "template",
    links: "template",
    research: "template",
    projects: "template",
    experience: "template",
    recommendations: "template",
    education: "template",
    skills: "template",
    resume: "template",
    site_settings: "template"
  }
};

function createSheets(overrides: Partial<RawPortfolioSheets> = {}): RawPortfolioSheets {
  return {
    profile: [
      { key: "full_name", value: "Demo Person" },
      { key: "headline", value: "Builder" },
      { key: "location", value: "City State" },
      { key: "email", value: "demo@example.com" },
      { key: "short_bio", value: "Short biography." },
      { key: "resume_url", value: "/resume/demo.pdf" }
    ],
    links: [
      {
        id: "github",
        label: "GitHub",
        url: "https://github.com/example",
        icon: "github",
        kind: "github",
        is_primary: "yes",
        show_on_home: "true",
        show_in_header: "1",
        show_in_footer: "true",
        order: "1"
      }
    ],
    research: [
      {
        id: "research-a",
        title: "Research A",
        role: "Researcher",
        organization: "Lab",
        location: "Remote",
        start_date: "2025-01",
        end_date: "Present",
        home_summary: "Home research.",
        detail_summary: "Detail research.",
        impact: "Useful findings.",
        bullets: "Read papers|Wrote summary",
        skills: "Security|Research",
        links: "Paper=https://example.com/paper",
        image: "/images/research/a.png",
        featured: "true",
        show_on_home: "true",
        home_order: "2",
        detail_order: "2"
      },
      {
        id: "research-b",
        title: "Research B",
        role: "Researcher",
        organization: "Lab",
        location: "Remote",
        start_date: "2024-01",
        end_date: "2024-05",
        home_summary: "Second research.",
        detail_summary: "Second detail.",
        impact: "Useful notes.",
        bullets: "Built rubric",
        skills: "Writing",
        links: "https://example.com/simple",
        image: "",
        featured: "false",
        show_on_home: "true",
        home_order: "1",
        detail_order: "1"
      }
    ],
    projects: [
      {
        id: "project-a",
        title: "Project A",
        subtitle: "Pipeline",
        home_summary: "Home project.",
        detail_summary: "Detail project.",
        problem: "Hard-coded content.",
        solution: "Generated JSON.",
        impact: "Static pages.",
        stack: "TypeScript|Next.js",
        links: "Demo=https://example.com",
        image: "/images/projects/a.png",
        featured: "true",
        show_on_home: "true",
        home_order: "1",
        detail_order: "1"
      }
    ],
    experience: [
      {
        id: "experience-a",
        title: "Intern",
        organization: "Company",
        type: "internship",
        location: "Remote",
        start_date: "2025-06",
        end_date: "2025-08",
        home_summary: "Home experience.",
        detail_summary: "Detail experience.",
        bullets: "Built feature|Wrote tests",
        skills: "React|Testing",
        featured: "true",
        show_on_home: "true",
        home_order: "1",
        detail_order: "1"
      }
    ],
    recommendations: [
      {
        id: "recommendation-a",
        recommender_name: "Alex Manager",
        recommender_title: "Engineering Manager",
        recommender_organization: "Example Company",
        relationship: "Managed the internship project.",
        recommendation_date: "2025-09",
        source: "LinkedIn",
        source_url: "https://www.linkedin.com/in/example",
        linkedin_url: "https://www.linkedin.com/in/example/details/recommendations/",
        home_quote: "A thoughtful engineer who communicates clearly.",
        full_quote: "A thoughtful engineer who communicates clearly and turns ambiguous product goals into maintainable software.",
        context: "Worked together during a summer internship.",
        skills: "Communication|TypeScript",
        featured: "true",
        show_on_home: "true",
        home_order: "1",
        detail_order: "2"
      },
      {
        id: "recommendation-b",
        recommender_name: "Jordan Peer",
        recommender_title: "Software Engineer",
        recommender_organization: "Example Lab",
        relationship: "Collaborated on research tooling.",
        recommendation_date: "2024-04",
        source: "Peer",
        source_url: "",
        linkedin_url: "",
        home_quote: "",
        full_quote: "Reliable collaborator with strong technical judgment.",
        context: "",
        skills: "Research|Testing",
        featured: "false",
        show_on_home: "true",
        home_order: "2",
        detail_order: "1"
      }
    ],
    education: [
      {
        id: "education-a",
        institution: "University",
        degree: "BS",
        field: "Computer Science",
        location: "City",
        start_date: "2022-09",
        end_date: "2026-05",
        home_summary: "Home education.",
        detail_summary: "Detail education.",
        bullets: "Algorithms|Systems",
        featured: "true",
        show_on_home: "true",
        home_order: "1",
        detail_order: "1"
      }
    ],
    skills: [
      { id: "skill-ts", category: "languages", name: "TypeScript", priority: "1", featured: "true", show_on_home: "true", order: "2" },
      { id: "skill-py", category: "languages", name: "Python", priority: "1", featured: "true", show_on_home: "true", order: "1" },
      { id: "skill-sec", category: "cybersecurity", name: "Security", priority: "2", featured: "false", show_on_home: "true", order: "3" }
    ],
    resume: [{ section: "summary", key: "headline", value: "Resume summary.", order: "1" }],
    site_settings: [
      { key: "site_title", value: "Demo" },
      { key: "site_description", value: "Demo description." },
      { key: "enable_skeletons", value: "true" },
      { key: "enable_recommendations", value: "true" },
      { key: "show_empty_recommendations", value: "false" },
      { key: "max_home_research_items", value: "1" },
      { key: "max_home_project_items", value: "1" },
      { key: "max_home_experience_items", value: "1" },
      { key: "max_home_recommendation_items", value: "1" },
      { key: "recommendations_nav_label", value: "Recommendations" },
      { key: "max_home_skill_items", value: "2" }
    ],
    ...overrides
  };
}

describe("CSV parsing and field normalization", () => {
  it("parses Google Sheets-compatible CSV rows", () => {
    expect(parseCsv("id,label\none,Example\n")).toEqual([{ id: "one", label: "Example" }]);
  });

  it("normalizes pipe-delimited lists and links", () => {
    expect(normalizePipeDelimitedList("Python| TypeScript |Next.js")).toEqual(["Python", "TypeScript", "Next.js"]);
    expect(normalizeLinkList("GitHub=https://github.com/example|https://example.com")).toEqual([
      { label: "GitHub", url: "https://github.com/example" },
      { label: "example.com", url: "https://example.com" }
    ]);
  });

  it("normalizes booleans, numbers, URLs, and dates", () => {
    expect(normalizeBoolean("yes")).toBe(true);
    expect(normalizeBoolean("0")).toBe(false);
    expect(() => normalizeBoolean("sometimes", "test.boolean")).toThrow(/Invalid boolean/);
    expect(normalizeNumber("42", "test.number")).toBe(42);
    expect(isSupportedUrl("/resume/demo.pdf")).toBe(true);
    expect(isSupportedUrl("/resume/../secret.pdf")).toBe(false);
    expect(isSupportedUrl("/resume/%2e%2e/secret.pdf")).toBe(false);
    expect(isSupportedUrl("not a url")).toBe(false);
    expect(isHttpsUrl("https://www.linkedin.com/in/example")).toBe(true);
    expect(isHttpsUrl("http://www.linkedin.com/in/example")).toBe(false);
    expect(formatDateRange("2025-06", "2025-08")).toBe("Jun 2025 to Aug 2025");
  });
});

describe("portfolio normalization", () => {
  it("creates the generated content shape", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);

    expect(content.profile.fullName).toBe("Demo Person");
    expect(content.research[0]?.bullets).toEqual(["Read papers", "Wrote summary"]);
    expect(content.projects[0]?.stack).toEqual(["TypeScript", "Next.js"]);
    expect(content.recommendations[0]?.skills).toEqual(["Communication", "TypeScript"]);
    expect(content.siteSettings.enableRecommendations).toBe(true);
    expect(content.siteSettings.showEmptyRecommendations).toBe(false);
    expect(content.siteSettings.maxHomeRecommendationItems).toBe(1);
    expect(content.siteSettings.recommendationsNavLabel).toBe("Recommendations");
  });

  it("validates required profile fields, IDs, duplicates, and URLs", () => {
    expect(() => normalizePortfolioContent(createSheets({ profile: [] }), metadata)).toThrow(/profile.fullName is required/);
    expect(() => normalizePortfolioContent(createSheets({ projects: [{ title: "Missing ID" }] }), metadata)).toThrow(/missing required field: id/);
    expect(() =>
      normalizePortfolioContent(
        createSheets({
          skills: [
            { id: "skill-ts", category: "languages", name: "TypeScript", priority: "1", featured: "true", show_on_home: "true", order: "1" },
            { id: "skill-ts", category: "languages", name: "TypeScript", priority: "1", featured: "true", show_on_home: "true", order: "2" }
          ]
        }),
        metadata
      )
    ).toThrow(/duplicate id/);
    expect(() => normalizePortfolioContent(createSheets({ links: [{ id: "bad", label: "Bad", url: "not valid", kind: "external" }] }), metadata)).toThrow(/invalid url/);
    expect(() =>
      normalizePortfolioContent(
        createSheets({
          recommendations: [
            { id: "recommendation-a", recommender_name: "Alex Manager", full_quote: "Good work.", featured: "true", show_on_home: "true" },
            { id: "recommendation-a", recommender_name: "Alex Manager", full_quote: "Good work.", featured: "false", show_on_home: "true" }
          ]
        }),
        metadata
      )
    ).toThrow(/duplicate id/);
    expect(() =>
      normalizePortfolioContent(
        createSheets({
          recommendations: [
            {
              id: "recommendation-bad-url",
              recommender_name: "Alex Manager",
              full_quote: "Good work.",
              linkedin_url: "http://www.linkedin.com/in/example",
              featured: "true",
              show_on_home: "true"
            }
          ]
        }),
        metadata
      )
    ).toThrow(/https URL/);
    expect(() =>
      normalizePortfolioContent(
        createSheets({
          recommendations: [{ id: "recommendation-missing", recommender_name: "", full_quote: "", featured: "true", show_on_home: "true" }]
        }),
        metadata
      )
    ).toThrow(/missing required field/);
  });
});

describe("content selection and sorting", () => {
  it("sorts Home content by featured before home order", () => {
    const sorted = sortForHome([
      { id: "b", title: "B", featured: false, homeOrder: 1 },
      { id: "a", title: "A", featured: true, homeOrder: 9 }
    ]);

    expect(sorted[0]?.title).toBe("A");
  });

  it("sorts detail content by featured before detail order", () => {
    const sorted = sortForDetail([
      { id: "b", title: "B", featured: false, detailOrder: 1 },
      { id: "a", title: "A", featured: true, detailOrder: 9 }
    ]);

    expect(sorted[0]?.title).toBe("A");
  });

  it("selects limited Home content from settings", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);
    const homeContent = selectHomeContent(content);

    expect(homeContent.research).toHaveLength(1);
    expect(homeContent.projects).toHaveLength(1);
    expect(homeContent.experience).toHaveLength(1);
    expect(homeContent.recommendations).toHaveLength(1);
    expect(homeContent.skillGroups.flatMap((group) => group.skills)).toHaveLength(2);
  });

  it("selects, sorts, and excerpts recommendations", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);

    expect(hasRecommendations(content.recommendations)).toBe(true);
    expect(shouldShowRecommendationsRoute(content)).toBe(true);
    expect(selectHomeRecommendations(content.recommendations, 1)[0]?.id).toBe("recommendation-a");
    expect(sortRecommendationsForDetail(content.recommendations).map((item) => item.id)).toEqual(["recommendation-a", "recommendation-b"]);
    expect(
      createRecommendationExcerpt(
        "This is a long recommendation that should be shortened for the Home page when the spreadsheet does not provide a home quote.",
        74
      )
    ).toBe("This is a long recommendation that should be shortened for the Home page w...");
  });

  it("hides the Recommendations route when empty unless empty display is enabled", () => {
    const emptyContent = normalizePortfolioContent(createSheets({ recommendations: [] }), metadata);
    const emptyRouteContent = normalizePortfolioContent(
      createSheets({
        recommendations: [],
        site_settings: [
          { key: "enable_recommendations", value: "true" },
          { key: "show_empty_recommendations", value: "true" }
        ]
      }),
      metadata
    );

    expect(hasRecommendations(emptyContent.recommendations)).toBe(false);
    expect(shouldShowRecommendationsRoute(emptyContent)).toBe(false);
    expect(shouldShowRecommendationsRoute(emptyRouteContent)).toBe(true);
  });

  it("falls back to featured Home items when nothing is marked show_on_home", () => {
    const content = normalizePortfolioContent(
      createSheets({
        projects: [
          {
            id: "project-featured",
            title: "Featured Project",
            featured: "true",
            show_on_home: "false",
            home_order: "1",
            detail_order: "1"
          }
        ]
      }),
      metadata
    );

    expect(selectHomeContent(content).projects[0]?.id).toBe("project-featured");
  });

  it("falls back to sorted items when no Home or featured items exist", () => {
    const content = normalizePortfolioContent(
      createSheets({
        research: [
          { id: "research-c", title: "C", featured: "false", show_on_home: "false", home_order: "2", detail_order: "2" },
          { id: "research-a", title: "A", featured: "false", show_on_home: "false", home_order: "1", detail_order: "1" }
        ]
      }),
      metadata
    );

    expect(selectHomeContent(content).research[0]?.id).toBe("research-a");
  });

  it("groups skills by category and handles empty selections", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);
    const groups = groupSkillsByCategory(content.skills);

    expect(groups.find((group) => group.category === "languages")?.skills.map((skill) => skill.name)).toEqual(["Python", "TypeScript"]);

    const emptyContent = normalizePortfolioContent(createSheets({ research: [], projects: [], experience: [], education: [], skills: [] }), metadata);
    expect(selectHomeContent(emptyContent).skillGroups).toEqual([]);
  });
});
