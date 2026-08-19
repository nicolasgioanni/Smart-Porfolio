import { readFileSync } from "node:fs";
import path from "node:path";
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
  selectHeaderLinks,
  selectHomeContent,
  selectHomeRecommendations,
  shouldShowRecommendationsRoute
} from "@/lib/content/selectHomeContent";
import {
  createProfileOverviewContent,
  createShortAboutText,
  formatCompactGraduationDate,
  getCurrentExperience,
  getCurrentWorkLabel,
  getEducationDisplayLabel,
  getPrimaryEducation,
  getProfileIdentityItems,
  getProfileContactLinks,
  getSelectedResearch
} from "@/lib/content/profileOverview";
import { sortForDetail, sortForHome, sortRecommendationsForDetail } from "@/lib/content/sortPortfolioContent";
import { isHttpsUrl, isIsoDate, isSupportedUrl } from "@/lib/content/validatePortfolioContent";
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

const brentFullQuote =
  "Nicolas has worked with me on an open source project, CytoCV, in collaboration with biologists at the University of Utah. He has excelled in many critical areas on this project including software engineering, web development, UX, computer vision, and the ability to work with biologists and translate their needs into software. Nicolas is proactive in identifying and solving issues and has demonstrated excellent skills in writing, documentation, and collaboration.";

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
        organization_logo: "/images/research/lab.svg",
        organization_logo_alt: "Lab mark",
        location: "Remote",
        start_date: "2025-01",
        end_date: "Present",
        home_summary: "Home research.",
        profile_summary: "Profile research.",
        detail_summary: "Detail research.",
        impact: "Useful findings.",
        bullets: "Read papers|Wrote summary",
        skills: "Security|Research",
        links: "Paper=https://example.com/paper",
        pending_links: "Manuscript",
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
        pending_links: "",
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
        organization_logo: "/images/experience/company.svg",
        organization_logo_alt: "Company mark",
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
        institution_logo: "/images/education/university-logo.svg",
        institution_logo_alt: "University logo",
        degree: "BS",
        field: "Computer Science",
        concentration: "Information Assurance",
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
      { key: "max_home_skill_items", value: "2" },
      { key: "license_name", value: "MIT" },
      { key: "license_url", value: "https://github.com/example/portfolio/blob/main/LICENSE" },
      { key: "repository_url", value: "https://github.com/example/portfolio" },
      { key: "legal_contact_email", value: "legal@example.com" },
      { key: "legal_effective_date", value: "2026-08-07" },
      { key: "hosting_provider_name", value: "Vercel" },
      { key: "hosting_privacy_url", value: "https://vercel.com/legal/privacy-notice" }
    ],
    ...overrides
  };
}

const templateSheetNames: Array<keyof RawPortfolioSheets> = [
  "profile",
  "links",
  "research",
  "projects",
  "experience",
  "recommendations",
  "education",
  "skills",
  "resume",
  "site_settings"
];

function readTemplateSheets(): RawPortfolioSheets {
  const templateDirectory = path.join(process.cwd(), "src", "content", "templates");

  return Object.fromEntries(
    templateSheetNames.map((sheetName) => [
      sheetName,
      parseCsv(readFileSync(path.join(templateDirectory, `${sheetName}.csv`), "utf8"))
    ])
  ) as RawPortfolioSheets;
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
    expect(isIsoDate("2026-08-07")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("August 7, 2026")).toBe(false);
    expect(formatDateRange("2025-06", "2025-08")).toBe("Jun 2025 to Aug 2025");
  });
});

describe("portfolio normalization", () => {
  it("creates the generated content shape", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);

    expect(content.profile.fullName).toBe("Demo Person");
    expect(content.research[0]?.bullets).toEqual(["Read papers", "Wrote summary"]);
    expect(content.research[0]?.organizationLogo).toBe("/images/research/lab.svg");
    expect(content.research[0]?.organizationLogoAlt).toBe("Lab mark");
    expect(content.research[0]?.profileContributions).toEqual([]);
    expect(content.research[0]?.profileLabs).toEqual([]);
    expect(content.research[0]?.pendingLinks).toEqual(["Manuscript"]);
    expect(content.projects[0]?.stack).toEqual(["TypeScript", "Next.js"]);
    expect(content.projects[0]?.homeSkills).toEqual([]);
    expect(content.experience[0]?.organizationLogo).toBe("/images/experience/company.svg");
    expect(content.experience[0]?.organizationLogoAlt).toBe("Company mark");
    expect(content.recommendations[0]?.skills).toEqual(["Communication", "TypeScript"]);
    expect(content.recommendations[0]?.fullQuoteLink).toBeUndefined();
    expect(content.education[0]?.institutionLogo).toBe("/images/education/university-logo.svg");
    expect(content.education[0]?.institutionLogoAlt).toBe("University logo");
    expect(content.education[0]?.concentration).toBe("Information Assurance");
    expect(content.siteSettings.enableRecommendations).toBe(true);
    expect(content.siteSettings.showEmptyRecommendations).toBe(false);
    expect(content.siteSettings.defaultTheme).toBe("navy");
    expect(content.siteSettings.maxHomeRecommendationItems).toBe(1);
    expect(content.siteSettings.recommendationsNavLabel).toBe("Recommendations");
    expect(content.siteSettings.licenseName).toBe("MIT");
    expect(content.siteSettings.repositoryUrl).toBe("https://github.com/example/portfolio");
    expect(content.siteSettings.legalContactEmail).toBe("legal@example.com");
    expect(content.siteSettings.legalEffectiveDate).toBe("2026-08-07");
    expect(content.siteSettings.hostingProviderName).toBe("Vercel");
    expect(content.siteSettings.hostingPrivacyUrl).toBe("https://vercel.com/legal/privacy-notice");
  });

  it("normalizes a paired recommendation quote label and HTTPS URL", () => {
    const sheets = createSheets();
    sheets.recommendations[0]!.full_quote = "Nicolas made CytoCV easier to use.";
    sheets.recommendations[0]!.full_quote_link_label = "CytoCV";
    sheets.recommendations[0]!.full_quote_link_url = "https://github.com/BrentLagesse/CytoCV";

    const content = normalizePortfolioContent(sheets, metadata);

    expect(content.recommendations[0]?.fullQuoteLink).toEqual({
      label: "CytoCV",
      url: "https://github.com/BrentLagesse/CytoCV"
    });
  });

  it.each([
    ["label only", "CytoCV", ""],
    ["URL only", "", "https://github.com/BrentLagesse/CytoCV"]
  ])("rejects a recommendation quote link with %s", (_caseName, label, url) => {
    const sheets = createSheets();
    sheets.recommendations[0]!.full_quote = "Nicolas made CytoCV easier to use.";
    sheets.recommendations[0]!.full_quote_link_label = label;
    sheets.recommendations[0]!.full_quote_link_url = url;

    expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(
      /full_quote_link_label and .*full_quote_link_url must both be provided/i
    );
  });

  it.each(["http://github.com/BrentLagesse/CytoCV", "javascript:alert(1)"])(
    "rejects a non-HTTPS recommendation quote link URL: %s",
    (url) => {
      const sheets = createSheets();
      sheets.recommendations[0]!.full_quote = "Nicolas made CytoCV easier to use.";
      sheets.recommendations[0]!.full_quote_link_label = "CytoCV";
      sheets.recommendations[0]!.full_quote_link_url = url;

      expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(
        /full_quote_link_url must be a safe https URL/i
      );
    }
  );

  it.each([
    ["missing", "A recommendation without the project label.", "CytoCV"],
    ["case-mismatched", "Nicolas made CytoCV easier to use.", "cytocv"],
    ["repeated", "CytoCV made CytoCV easier to use.", "CytoCV"]
  ])("rejects a %s recommendation quote link label", (_caseName, fullQuote, label) => {
    const sheets = createSheets();
    sheets.recommendations[0]!.full_quote = fullQuote;
    sheets.recommendations[0]!.full_quote_link_label = label;
    sheets.recommendations[0]!.full_quote_link_url = "https://github.com/BrentLagesse/CytoCV";

    expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(
      /full_quote_link_label must appear exactly once in full_quote/i
    );
  });

  it.each([
    ["repository_url", "http://github.com/example/portfolio", /repositoryUrl has an invalid URL/],
    ["license_url", "http://github.com/example/portfolio/LICENSE", /licenseUrl has an invalid URL/],
    ["legal_contact_email", "not-an-email", /legalContactEmail has an invalid email address/],
    ["legal_effective_date", "2026-02-30", /legalEffectiveDate has an invalid ISO date/],
    ["hosting_privacy_url", "http://vercel.com/legal/privacy-notice", /hostingPrivacyUrl has an invalid URL/]
  ])("rejects invalid legal setting %s", (key, value, expectedError) => {
    const sheets = createSheets();
    sheets.site_settings = sheets.site_settings.map((row) => (row.key === key ? { ...row, value } : row));

    expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(expectedError);
  });

  it("maps ordered project skill explanations while preserving optional legacy entries", () => {
    const sheets = createSheets();
    const project = sheets.projects[0]!;
    project.home_skills = "TypeScript=typescript|Next.js=nextdotjs";
    project.home_skill_1_summary = "TypeScript provides the typed application layer.";
    project.home_skill_1_details = "Typed project code coordinates data across the application boundary.";

    const content = normalizePortfolioContent(sheets, metadata);

    expect(content.projects[0]?.homeSkills).toEqual([
      {
        name: "TypeScript",
        icon: "typescript",
        summary: "TypeScript provides the typed application layer.",
        details: "Typed project code coordinates data across the application boundary."
      },
      { name: "Next.js", icon: "nextdotjs" }
    ]);
  });

  it.each(["home_skill_1_summary", "home_skill_1_details"])(
    "rejects a project skill with only %s",
    (fieldName) => {
      const sheets = createSheets();
      const project = sheets.projects[0]!;
      project.home_skills = "TypeScript=typescript";
      project[fieldName] = "Incomplete tool explanation.";

      expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(
        /projects\.project-a\.homeSkills\[0\] must provide summary and details together/
      );
    }
  );

  it("rejects project skill explanation fields without a matching ordered skill", () => {
    const sheets = createSheets();
    const project = sheets.projects[0]!;
    project.home_skills = "TypeScript=typescript";
    project.home_skill_2_summary = "Orphan summary.";
    project.home_skill_2_details = "Orphan technical details.";

    expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(
      /projects row 2\.home_skills has popup copy for missing skill position 2/
    );
  });

  it("rejects more than three ordered Home project skills", () => {
    const sheets = createSheets();
    sheets.projects[0]!.home_skills =
      "TypeScript=typescript|Next.js=nextdotjs|Python=python|OpenAI API=openai";

    expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(
      /projects row 2\.home_skills must contain at most 3 skills/
    );
  });

  it("normalizes typed profile overview row references", () => {
    const sheets = createSheets();
    sheets.profile.push(
      { key: "current_experience_id", value: "experience-a" },
      { key: "previous_experience_id", value: "experience-a" },
      { key: "featured_research_id", value: "research-a" },
      { key: "primary_education_id", value: "education-a" }
    );

    const content = normalizePortfolioContent(sheets, metadata);

    expect(content.profile.currentExperienceId).toBe("experience-a");
    expect(content.profile.previousExperienceId).toBe("experience-a");
    expect(content.profile.featuredResearchId).toBe("research-a");
    expect(content.profile.primaryEducationId).toBe("education-a");
  });

  it("maps and parses the spreadsheet-driven Home role and structured research profile fields", () => {
    const sheets = createSheets();
    sheets.profile.push(
      { key: "preferred_name", value: "Demo Preferred" },
      { key: "role_engineer_prefixes", value: "Software | AI | Security" },
      { key: "role_engineer_suffix", value: "Engineer" },
      { key: "role_alternate", value: "Research Scientist" }
    );
    sheets.research[0]!.home_title = "Research A Home";
    sheets.research[0]!.role = "Graduate Research Assistant";
    sheets.research[0]!.profile_contributions = "Lead Developer|First Author";
    sheets.research[0]!.profile_labs = "SEE Lab|Miller Lab";

    const content = normalizePortfolioContent(sheets, metadata);
    const overview = createProfileOverviewContent(content);

    expect(content.profile).toMatchObject({
      roleEngineerPrefixes: "Software | AI | Security",
      roleEngineerSuffix: "Engineer",
      roleAlternate: "Research Scientist"
    });
    expect(overview.greetingName).toBe("Demo Preferred");
    expect(overview.role).toEqual({
      kind: "rotating",
      engineerPrefixes: ["Software", "AI", "Security"],
      engineerSuffix: "Engineer",
      alternate: "Research Scientist"
    });
    expect(content.research[0]?.homeTitle).toBe("Research A Home");
    expect(content.research[0]?.profileContributions).toEqual(["Lead Developer", "First Author"]);
    expect(content.research[0]?.profileLabs).toEqual(["SEE Lab", "Miller Lab"]);
    expect(overview.research?.title).toBe("Research A Home");
    expect(overview.research).toMatchObject({
      position: "Graduate Research Assistant",
      contributions: ["Lead Developer", "First Author"],
      labs: ["SEE Lab", "Miller Lab"]
    });
    expect(overview.research).not.toHaveProperty("summary");
  });

  it.each([
    ["profile summary", "Compact profile research.", "Home research.", "Detail research.", "Compact profile research."],
    ["legacy Home summary", undefined, "Home research.", "Detail research.", "Home research."],
    ["legacy detail summary", undefined, undefined, "Detail research.", "Detail research."],
    ["no available summary", undefined, undefined, undefined, undefined]
  ] as const)(
    "uses the %s fallback for compact research",
    (_label, profileSummary, homeSummary, detailSummary, expectedSummary) => {
      const content = normalizePortfolioContent(createSheets(), metadata);
      const selectedResearch = content.research[0]!;
      content.research = [
        {
          ...selectedResearch,
          profileSummary,
          homeSummary,
          detailSummary
        }
      ];

      expect(createProfileOverviewContent(content).research?.summary).toBe(expectedSummary);
    }
  );

  it.each([
    [[{ key: "role_engineer_prefixes", value: "Software|AI" }]],
    [[
      { key: "role_engineer_prefixes", value: "Software|AI" },
      { key: "role_engineer_suffix", value: "Engineer" }
    ]],
    [[{ key: "role_alternate", value: "Research Scientist" }]]
  ])("rejects a partial Home role configuration", (roleRows) => {
    const sheets = createSheets();
    sheets.profile.push(...roleRows);

    expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(/requires roleEngineerPrefixes, roleEngineerSuffix, and roleAlternate together/);
  });

  it("rejects a Home role configuration whose parsed prefix list is empty", () => {
    const sheets = createSheets();
    sheets.profile.push(
      { key: "role_engineer_prefixes", value: "| |" },
      { key: "role_engineer_suffix", value: "Engineer" },
      { key: "role_alternate", value: "Research Scientist" }
    );

    expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(/at least one pipe-delimited role prefix/);
  });

  it("uses the legacy headline as a static role when rotation fields are absent", () => {
    const overview = createProfileOverviewContent(normalizePortfolioContent(createSheets(), metadata));

    expect(overview.greetingName).toBe("Demo");
    expect(overview.role).toEqual({ kind: "static", label: "Builder" });
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
    expect(() =>
      normalizePortfolioContent(
        createSheets({
          education: [
            {
              id: "education-bad-logo",
              institution: "University",
              institution_logo: "mailto:bad@example.com",
              degree: "BS",
              featured: "true",
              show_on_home: "true"
            }
          ]
        }),
        metadata
      )
    ).toThrow(/institutionLogo URL/);
  });

  it.each([
    ["current_experience_id", "currentExperienceId"],
    ["previous_experience_id", "previousExperienceId"],
    ["featured_research_id", "featuredResearchId"],
    ["primary_education_id", "primaryEducationId"]
  ])("rejects an unknown profile row reference in %s", (profileKey, normalizedField) => {
    const sheets = createSheets();
    sheets.profile.push({ key: profileKey, value: "missing-row" });

    expect(() => normalizePortfolioContent(sheets, metadata)).toThrow(
      new RegExp(`profile\\.${normalizedField} references an unknown id: missing-row`)
    );
  });

  it("keeps configured template references connected to their editable CSV rows", () => {
    const content = normalizePortfolioContent(readTemplateSheets(), metadata);
    const overview = createProfileOverviewContent(content);
    const currentExperience = content.experience.find((item) => item.id === content.profile.currentExperienceId);
    const previousExperience = content.experience.find((item) => item.id === content.profile.previousExperienceId);
    const featuredResearch = content.research.find((item) => item.id === content.profile.featuredResearchId);
    const primaryEducation = content.education.find((item) => item.id === content.profile.primaryEducationId);

    if (content.profile.currentExperienceId) {
      expect(currentExperience).toBeDefined();
      expect(overview.currentWork).toMatchObject({
        id: currentExperience!.id,
        title: currentExperience!.title,
        organization: currentExperience!.organization,
        startDate: currentExperience!.startDate,
        endDate: currentExperience!.endDate,
        summary: currentExperience!.homeSummary
      });
    }

    if (content.profile.previousExperienceId) {
      expect(previousExperience).toBeDefined();
      expect(content.experience).toContain(previousExperience);
      expect(overview).not.toHaveProperty("previousWork");
    }

    if (content.profile.featuredResearchId) {
      expect(featuredResearch).toBeDefined();
      expect(overview.research).toMatchObject({
        id: featuredResearch!.id,
        title: featuredResearch!.homeTitle ?? featuredResearch!.title,
        links: featuredResearch!.links,
        pendingLinks: featuredResearch!.pendingLinks,
        logo: {
          src: featuredResearch!.organizationLogo,
          alt: featuredResearch!.organizationLogoAlt
        }
      });
      if (featuredResearch!.profileContributions?.length || featuredResearch!.profileLabs?.length) {
        expect(overview.research).toMatchObject({
          position: featuredResearch!.role,
          contributions: featuredResearch!.profileContributions,
          labs: featuredResearch!.profileLabs
        });
        expect(overview.research).not.toHaveProperty("summary");
      } else {
        expect(overview.research?.summary).toBe(
          featuredResearch!.profileSummary ?? featuredResearch!.homeSummary ?? featuredResearch!.detailSummary
        );
      }
      expect(overview.research).not.toHaveProperty("organization");
    }

    if (content.profile.primaryEducationId) {
      expect(primaryEducation).toBeDefined();
      expect(overview.education).toMatchObject({
        id: primaryEducation!.id,
        institution: content.profile.university ?? primaryEducation!.institution,
        degree: content.profile.degree ?? primaryEducation!.degree,
        field: content.profile.fieldOfStudy ?? primaryEducation!.field,
        concentration: primaryEducation!.concentration,
        location: primaryEducation!.location,
        startDate: primaryEducation!.startDate,
        endDate: content.profile.graduation ?? primaryEducation!.endDate,
        graduationLabel: formatCompactGraduationDate(content.profile.graduation ?? primaryEducation!.endDate)
      });
    }

    expect(overview.greetingName).toBe("Nicolas");
    expect(overview.role).toEqual({
      kind: "rotating",
      engineerPrefixes: ["Software", "AI", "Security"],
      engineerSuffix: "Engineer",
      alternate: "Research Scientist"
    });
    expect(content.profile.headline).toBe("Software Engineer");
    expect(content.profile.shortBio).toBe(
      "I’m ambitious, relentlessly curious, and always looking for the next hard problem to learn from. I care about moving with urgency, doing things well, and getting better with every project."
    );
  });

  it("publishes Treasury as current work and closes the prior research role in August 2026", () => {
    const content = normalizePortfolioContent(readTemplateSheets(), metadata);
    const overview = createProfileOverviewContent(content);
    const homeContent = selectHomeContent(content);
    const treasuryRole = content.experience.find((item) => item.id === "us-treasury-ai-engineer");
    const priorResearchRole = content.experience.find(
      (item) => item.id === "research-assistant-software-engineering"
    );
    const cytocvResearch = content.research.find((item) => item.id === "cytocv-miller-lab");

    expect(content.profile).toMatchObject({
      currentTitle: "AI Engineer",
      currentCompany: "U.S. Department of the Treasury",
      currentExperienceId: "us-treasury-ai-engineer",
      previousExperienceId: "research-assistant-software-engineering"
    });
    expect(treasuryRole).toMatchObject({
      title: "AI Engineer",
      organization: "U.S. Department of the Treasury",
      organizationLogo: "/images/organizations/us_treasury_logo.webp",
      organizationLogoAlt: "U.S. Department of the Treasury logo",
      startDate: "2026-08",
      endDate: "Present",
      homeOrder: 1,
      detailOrder: 1
    });
    expect(treasuryRole?.homeSummary).toBeUndefined();
    expect(homeContent.experience[0]?.id).toBe("us-treasury-ai-engineer");
    expect(overview.currentWork).toMatchObject({
      id: "us-treasury-ai-engineer",
      title: "AI Engineer",
      organization: "U.S. Department of the Treasury",
      startDate: "2026-08",
      endDate: "Present",
      dateLabel: "Aug 2026 – Present",
      logo: {
        src: "/images/organizations/us_treasury_logo.webp",
        alt: "U.S. Department of the Treasury logo"
      }
    });
    expect(overview.currentWork?.summary).toBeUndefined();
    expect(priorResearchRole?.endDate).toBe("2026-08");
    expect(formatDateRange(priorResearchRole?.startDate, priorResearchRole?.endDate)).toBe(
      "Aug 2024 to Aug 2026"
    );
    expect(cytocvResearch?.endDate).toBe("2026-08");
  });

  it("associates the approved university logos through template content", () => {
    const content = normalizePortfolioContent(readTemplateSheets(), metadata);
    const expectedOrganizationLogos = new Map([
      [
        "University of Washington",
        { organizationLogo: "/images/organizations/uw_logo.png", organizationLogoAlt: "University of Washington logo" }
      ],
      [
        "UW Bothell School of STEM",
        { organizationLogo: "/images/organizations/uwb_stem_logo.png", organizationLogoAlt: "UW Bothell School of STEM logo" }
      ],
      [
        "U.S. Department of the Treasury",
        {
          organizationLogo: "/images/organizations/us_treasury_logo.webp",
          organizationLogoAlt: "U.S. Department of the Treasury logo"
        }
      ]
    ]);

    expect(content.education.find((item) => item.id === "uw-bscsse")).toMatchObject({
      institution: "University of Washington",
      institutionLogo: "/images/education/uw_logo.png",
      institutionLogoAlt: "University of Washington logo",
      degree: "Bachelor of Science",
      field: "Computer Science",
      concentration: "Information Assurance & Cybersecurity"
    });

    for (const item of [...content.experience, ...content.research]) {
      if (!item.organization) continue;

      const expectedLogo = expectedOrganizationLogos.get(item.organization);

      if (expectedLogo) {
        expect(item).toMatchObject(expectedLogo);
      }
    }
  });

  it("keeps Home recommendations and verified research actions connected to template content", () => {
    const content = normalizePortfolioContent(readTemplateSheets(), metadata);
    const cytocv = content.research.find((item) => item.id === "cytocv-miller-lab");
    const adversarialMl = content.research.find((item) => item.id === "adversarial-machine-learning");
    const guideDonor = content.research.find((item) => item.id === "yeast-dna-target-selection");

    expect(content.siteSettings).toMatchObject({
      enableRecommendations: true,
      showEmptyRecommendations: true,
      maxHomeRecommendationItems: 3
    });
    expect(cytocv).toMatchObject({
      title: "CytoCV: Web-based platform for reproducible yeast microscopy image analysis",
      homeTitle: "CytoCV",
      role: "Graduate Research Assistant",
      homeSummary:
        "Built by UW Bothell School of STEM’s SEE Lab for the University of Utah Miller Lab, CytoCV is a Django platform using Mask R-CNN to segment yeast microscopy stacks and export per-cell fluorescence measurements.",
      profileContributions: [
        "Lead Developer for CytoCV software",
        "First Author of the CytoCV manuscript"
      ],
      profileLabs: [
        "SEE Lab, UW Bothell School of STEM",
        "Miller Lab, University of Utah"
      ]
    });
    expect(cytocv?.profileSummary).toBeUndefined();
    expect(adversarialMl?.homeSummary).toBe(
      "Experimental study of targeted training-data poisoning against SVMs learning from streams, testing whether attacks can evade loss-based anomaly filtering and whether a feature-space stability metric can detect decision-boundary manipulation."
    );
    expect(guideDonor?.homeSummary).toBe(
      "Python sequence-design pipeline for yeast CRISPR/Cas9 experiments that selects 20-base guides near NGG PAMs, builds 132-base donor sequences around requested mutations, adds silent edits to prevent re-cutting, and exports XLS results."
    );
    const profileOverview = createProfileOverviewContent(content);
    expect(profileOverview.research).toMatchObject({
      title: "CytoCV",
      position: "Graduate Research Assistant",
      contributions: [
        "Lead Developer for CytoCV software",
        "First Author of the CytoCV manuscript"
      ],
      labs: [
        "SEE Lab, UW Bothell School of STEM",
        "Miller Lab, University of Utah"
      ],
      pendingLinks: ["Manuscript"],
      logo: {
        src: "/images/organizations/uwb_stem_logo.png",
        alt: "UW Bothell School of STEM logo"
      }
    });
    expect(profileOverview.research).not.toHaveProperty("summary");
    expect(profileOverview.education).toMatchObject({
      degree: "Bachelor of Science",
      field: "Computer Science",
      concentration: "Information Assurance & Cybersecurity"
    });
    expect(cytocv?.links).toEqual([
      { label: "Live site", url: "https://cytocv.uwb.edu" },
      { label: "Source code", url: "https://github.com/BrentLagesse/CytoCV" }
    ]);
    expect(cytocv?.pendingLinks).toEqual(["Manuscript"]);
    expect(adversarialMl?.links).toEqual([
      { label: "Source code", url: "https://github.com/nicolasgioanni/Independent-Study" },
      { label: "Manuscript", url: "https://faculty.washington.edu/lagesse/publications/CausativeSVM.pdf" }
    ]);
    expect(guideDonor?.links).toEqual([
      { label: "Source code", url: "https://github.com/BrentLagesse/GuideDonorScheduler" }
    ]);
  });

  it("maps the three Home projects, six skill groups, and four recommendations from template content", () => {
    const content = normalizePortfolioContent(readTemplateSheets(), metadata);
    const homeProjects = content.projects.filter((item) => item.showOnHome);
    const skillCounts = new Map<string, number>();

    for (const skill of content.skills) {
      skillCounts.set(skill.category, (skillCounts.get(skill.category) ?? 0) + 1);
    }

    expect(content.siteSettings).toMatchObject({
      maxHomeProjectItems: 3,
      maxHomeRecommendationItems: 3,
      maxHomeSkillItems: 36
    });
    expect(homeProjects.map((item) => item.title)).toEqual(["NotePal", "Clair", "LeetNotes"]);
    expect(homeProjects.every((item) => item.homeSkills.length === 3)).toBe(true);
    expect(content.projects.find((item) => item.id === "notepal")).toMatchObject({
      subtitle: "Multimodal study workspace",
      homeSkills: [
        {
          name: "Next.js",
          icon: "nextdotjs",
          summary: "Next.js powers NotePal's web interface and routing.",
          details:
            "The Next.js frontend provides the application interface, route structure, and authenticated study workflow while sending uploaded content to the separate Flask processing API."
        },
        {
          name: "TypeScript",
          icon: "typescript",
          summary: "TypeScript gives NotePal's frontend a typed application layer.",
          details:
            "TypeScript supports the Next.js component and routing code that coordinates file uploads, generated notes, quizzes, session state, and content-aware chat responses."
        },
        {
          name: "OpenAI API",
          icon: "openai",
          summary: "OpenAI API generates NotePal's language-based study features.",
          details:
            "Backend requests use OpenAI models for text summarization, multiple-choice and short-answer quiz generation, and chatbot answers based on content extracted from uploaded documents and media."
        }
      ]
    });
    expect(content.projects.find((item) => item.id === "clair")?.homeSkills).toEqual([
      {
        name: "Python",
        icon: "python",
        summary: "Python runs Clair's file-organization engine.",
        details:
          "Python 3.11 and the standard os module scan selected folders, map file extensions to JSON-defined categories, create destination folders, move files, and optionally remove empty directories."
      },
      {
        name: "Bash",
        icon: "gnubash",
        summary: "Bash supports Clair's source-based development workflow.",
        details:
          "Shell commands create and activate the development environment, install Python requirements, and launch the application from source; Clair's sorting logic itself remains Python-based."
      },
      {
        name: "PySide6",
        icon: "qt",
        summary: "PySide6 provides Clair's cross-platform desktop interface.",
        details:
          "Qt for Python renders the dark-mode controls for folder selection, category and extension management, reusable presets, recursive scanning, optional cleanup, and the one-click organization workflow."
      }
    ]);
    expect(content.projects.find((item) => item.id === "leetnotes")?.homeSkills).toEqual([
      {
        name: "Python",
        icon: "python",
        summary: "Python implements the LeetNotes synchronization CLI.",
        details:
          "The package reads published sheet CSVs, normalizes problem titles and LeetCode slugs, generates Markdown study notes, writes solution.py variants, and maintains the repository's indexed problem structure."
      },
      {
        name: "GitHub Actions",
        icon: "githubactions",
        summary: "GitHub Actions keeps generated study material synchronized.",
        details:
          "The scheduled notes.yml workflow runs the CLI, rebuilds notes and solution files from published sheet data, and commits any repository changes for review."
      },
      {
        name: "Google Sheets",
        icon: "googlesheets",
        summary: "Google Sheets serves as LeetNotes' editable content source.",
        details:
          "Each list uses paired Notes and Solutions sheets published as CSV: one stores problem metadata, approaches, complexity, and study notes; the other stores plain-text Python solutions."
      }
    ]);
    expect(Array.from(skillCounts.entries())).toEqual([
      ["Computer Vision & ML", 6],
      ["Cybersecurity & Systems", 6],
      ["Full-Stack Engineering", 6],
      ["Data & API Engineering", 6],
      ["Cloud & DevOps", 6],
      ["Applied AI & Research Computing", 6]
    ]);
    expect(content.skills.every((skill) => Boolean(skill.icon))).toBe(true);
    expect(content.recommendations.map((item) => item.recommenderName)).toEqual([
      "Brent Lagesse",
      "Annuska Zolyomi, PhD",
      "Anoop Prasad",
      "Minh Nhat Huynh"
    ]);
    expect(content.recommendations.find((item) => item.id === "brent-lagesse")).toMatchObject({
      fullQuote: brentFullQuote,
      fullQuoteLink: {
        label: "CytoCV",
        url: "https://github.com/BrentLagesse/CytoCV"
      }
    });
    expect(content.recommendations.find((item) => item.id === "brent-lagesse")?.fullQuote).not.toContain("https://");
    expect(content.recommendations.find((item) => item.id === "brent-lagesse")?.fullQuote.match(/CytoCV/g)).toHaveLength(1);
    expect(content.recommendations.filter((item) => item.showOnHome)).toHaveLength(3);
  });

  it("rejects mail links used as organization logos", () => {
    expect(() =>
      normalizePortfolioContent(
        createSheets({
          experience: [
            {
              id: "experience-logo",
              title: "Engineer",
              organization: "Company",
              organization_logo: "mailto:bad@example.com",
              featured: "true",
              show_on_home: "true"
            }
          ]
        }),
        metadata
      )
    ).toThrow(/experience\.experience-logo has an invalid organizationLogo URL/);

    expect(() =>
      normalizePortfolioContent(
        createSheets({
          research: [
            {
              id: "research-logo",
              title: "Research",
              organization_logo: "mailto:bad@example.com",
              featured: "true",
              show_on_home: "true"
            }
          ]
        }),
        metadata
      )
    ).toThrow(/research\.research-logo has an invalid organizationLogo URL/);
  });
});

describe("profile overview helpers", () => {
  const profile = {
    fullName: "Demo Person",
    headline: "Builder",
    location: "City State",
    timezone: "Pacific Time (UTC-07:00)",
    email: "demo@example.com",
    shortBio: "Short biography.",
    currentTitle: "Research Assistant",
    currentCompany: "Example Lab",
    university: "Profile University",
    degree: "BS",
    fieldOfStudy: "Computer Science",
    graduation: "Jun 2025",
    resumeUrl: "/resume/demo.pdf"
  };

  const experience = {
    id: "experience-current",
    title: "Software Engineer",
    organization: "Example Company",
    endDate: "Present",
    bullets: [],
    skills: [],
    featured: true,
    showOnHome: true
  };

  it("uses a current experience identity before the profile-only work fallback", () => {
    expect(getCurrentWorkLabel(profile, [experience])).toBe("Software Engineer at Example Company");
    expect(getCurrentWorkLabel(profile, [{ ...experience, endDate: "2025-08" }])).toBe("Research Assistant at Example Lab");
    expect(getCurrentWorkLabel({ ...profile, currentCompany: "" }, [])).toBe("Research Assistant");
  });

  it("maps spreadsheet rows into the compact identity overview without Previous Work", () => {
    const sheets = createSheets();
    sheets.research = sheets.research.map((row) => ({ ...row, featured: "false", show_on_home: "false" }));
    sheets.profile.push(
      { key: "headline", value: "CSV Headline Sentinel." },
      { key: "short_bio", value: "CSV About Sentinel." },
      { key: "current_title", value: "CSV Current Role Sentinel" },
      { key: "current_company", value: "CSV Current Organization Sentinel" },
      { key: "current_experience_id", value: "experience-current-sentinel" },
      { key: "previous_experience_id", value: "experience-previous-sentinel" },
      { key: "featured_research_id", value: "research-sentinel" },
      { key: "primary_education_id", value: "education-sentinel" },
      { key: "university", value: "CSV Education Institution Sentinel" },
      { key: "degree", value: "CSV Degree Sentinel" },
      { key: "field_of_study", value: "CSV Field Sentinel" },
      { key: "graduation", value: "2031-06" }
    );
    sheets.experience.push(
      {
        id: "experience-current-sentinel",
        title: "Current row title overridden by profile CSV",
        organization: "Current row organization overridden by profile CSV",
        organization_logo: "/images/organizations/current-csv-sentinel.svg",
        organization_logo_alt: "CSV current organization mark",
        start_date: "2023-03",
        end_date: "Present",
        home_summary: "CSV Current Summary Sentinel.",
        featured: "false",
        show_on_home: "false"
      },
      {
        id: "experience-previous-sentinel",
        title: "CSV Previous Role Sentinel",
        organization: "CSV Previous Organization Sentinel",
        organization_logo: "/images/organizations/previous-csv-sentinel.svg",
        organization_logo_alt: "CSV previous organization mark",
        start_date: "2020-02",
        end_date: "2022-11",
        featured: "false",
        show_on_home: "false"
      }
    );
    sheets.education.push({
      id: "education-sentinel",
      institution: "Education row institution overridden by profile CSV",
      institution_logo: "/images/organizations/education-csv-sentinel.svg",
      institution_logo_alt: "CSV education institution mark",
      degree: "Education row degree overridden by profile CSV",
      field: "Education row field overridden by profile CSV",
      concentration: "CSV Concentration Sentinel",
      location: "CSV Education Location Sentinel",
      start_date: "2025-09",
      end_date: "2030-05",
      featured: "false",
      show_on_home: "false"
    });
    sheets.research.push({
      id: "research-sentinel",
      title: "CSV Research Project Sentinel",
      role: "CSV Research Role Sentinel",
      organization: "CSV Research Organization Sentinel",
      organization_logo: "/images/organizations/research-csv-sentinel.svg",
      organization_logo_alt: "CSV research organization mark",
      start_date: "2026-01",
      end_date: "2027-12",
      home_summary: "CSV Research Summary Sentinel.",
      profile_summary: "CSV Profile Research Summary Sentinel.",
      links: "Live Sentinel=https://example.com/live-sentinel|Source Sentinel=https://github.com/example/source-sentinel",
      pending_links: "Manuscript Sentinel",
      featured: "false",
      show_on_home: "false"
    });

    const content = normalizePortfolioContent(sheets, metadata);
    const overview = createProfileOverviewContent(content);

    expect(overview).toEqual({
      greetingName: "Demo",
      role: { kind: "static", label: "CSV Headline Sentinel." },
      about: "CSV About Sentinel.",
      currentWork: {
        id: "experience-current-sentinel",
        title: "Current row title overridden by profile CSV",
        organization: "Current row organization overridden by profile CSV",
        startDate: "2023-03",
        endDate: "Present",
        dateLabel: "Mar 2023 \u2013 Present",
        summary: "CSV Current Summary Sentinel.",
        logo: { src: "/images/organizations/current-csv-sentinel.svg", alt: "CSV current organization mark" }
      },
      education: {
        id: "education-sentinel",
        institution: "CSV Education Institution Sentinel",
        degree: "CSV Degree Sentinel",
        field: "CSV Field Sentinel",
        concentration: "CSV Concentration Sentinel",
        location: "CSV Education Location Sentinel",
        startDate: "2025-09",
        endDate: "2031-06",
        graduationLabel: "Graduated Jun 2031",
        logo: { src: "/images/organizations/education-csv-sentinel.svg", alt: "CSV education institution mark" }
      },
      research: {
        id: "research-sentinel",
        title: "CSV Research Project Sentinel",
        summary: "CSV Profile Research Summary Sentinel.",
        links: [
          { label: "Live Sentinel", url: "https://example.com/live-sentinel" },
          { label: "Source Sentinel", url: "https://github.com/example/source-sentinel" }
        ],
        pendingLinks: ["Manuscript Sentinel"],
        logo: {
          src: "/images/organizations/research-csv-sentinel.svg",
          alt: "CSV research organization mark"
        }
      }
    });
    expect(content.profile.previousExperienceId).toBe("experience-previous-sentinel");
    expect(content.experience.some((item) => item.id === content.profile.previousExperienceId)).toBe(true);
    expect(content.research.find((item) => item.id === "research-sentinel")).toMatchObject({
      homeSummary: "CSV Research Summary Sentinel.",
      profileSummary: "CSV Profile Research Summary Sentinel.",
      pendingLinks: ["Manuscript Sentinel"]
    });
    expect(overview).not.toHaveProperty("previousWork");
    expect(overview.research).not.toHaveProperty("organization");
  });

  it("ignores ended Current Work pins, prefers Home research, and honors primary education", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);
    const baseExperience = content.experience[0]!;
    const baseResearch = content.research[0]!;
    const baseEducation = content.education[0]!;

    content.profile = {
      ...content.profile,
      headline: "Profile headline",
      currentTitle: "Profile title",
      currentCompany: "Profile company",
      currentExperienceId: "experience-selected",
      previousExperienceId: "experience-previous",
      featuredResearchId: "research-selected",
      primaryEducationId: "education-selected",
      university: "Profile University",
      degree: "Profile Degree",
      fieldOfStudy: "Profile Field",
      graduation: "Jun 2025"
    };
    content.experience = [
      { ...baseExperience, id: "experience-home", endDate: "Present", showOnHome: true },
      {
        ...baseExperience,
        id: "experience-selected",
        title: "Row title",
        organization: "Row company",
        organizationLogo: "/images/experience/selected.svg",
        organizationLogoAlt: "Selected company mark",
        startDate: "2023-01",
        endDate: "2024-06",
        featured: false,
        showOnHome: false
      },
      {
        ...baseExperience,
        id: "experience-previous",
        title: "Previous row title",
        organization: "Previous row company",
        organizationLogo: "/images/experience/previous.svg",
        organizationLogoAlt: "Previous company mark",
        startDate: "2021-02",
        endDate: "2022-11",
        featured: false,
        showOnHome: false
      }
    ];
    content.research = [
      { ...baseResearch, id: "research-home", endDate: "Present", showOnHome: true },
      {
        ...baseResearch,
        id: "research-selected",
        title: "Selected project",
        role: "Selected role",
        organization: "Selected lab",
        organizationLogo: "/images/research/selected.svg",
        organizationLogoAlt: undefined,
        startDate: "2022-01",
        endDate: "2022-12",
        homeSummary: "Selected research summary.",
        links: [{ label: "Paper", url: "https://example.com/paper" }],
        pendingLinks: ["Manuscript"],
        featured: false,
        showOnHome: false
      }
    ];
    content.education = [
      { ...baseEducation, id: "education-home", showOnHome: true },
      {
        ...baseEducation,
        id: "education-selected",
        institution: "Row University",
        institutionLogo: "/images/education/selected.svg",
        institutionLogoAlt: "Selected university mark",
        degree: "Row Degree",
        field: "Row Field",
        concentration: "Row Concentration",
        location: "Row City",
        startDate: "2020-09",
        endDate: "2024-05",
        featured: false,
        showOnHome: false
      }
    ];

    const overview = createProfileOverviewContent(content);

    expect(overview.greetingName).toBe("Demo");
    expect(overview.role).toEqual({ kind: "static", label: "Profile headline" });
    expect(overview.about).toBe("Short biography.");
    expect(overview.currentWork).toEqual({
      id: "experience-home",
      title: baseExperience.title,
      organization: baseExperience.organization,
      startDate: baseExperience.startDate,
      endDate: "Present",
      dateLabel: "Jun 2025 \u2013 Present",
      summary: baseExperience.homeSummary,
      logo: { src: "/images/experience/company.svg", alt: "Company mark" }
    });
    expect(overview.research).toEqual({
      id: "research-home",
      title: baseResearch.title,
      summary: baseResearch.profileSummary,
      links: baseResearch.links,
      pendingLinks: baseResearch.pendingLinks,
      logo: { src: "/images/research/lab.svg", alt: "Lab mark" }
    });
    expect(overview.education).toEqual({
      id: "education-selected",
      institution: "Profile University",
      degree: "Profile Degree",
      field: "Profile Field",
      concentration: "Row Concentration",
      location: "Row City",
      startDate: "2020-09",
      endDate: "Jun 2025",
      graduationLabel: "Graduated Jun 2025",
      logo: { src: "/images/education/selected.svg", alt: "Selected university mark" }
    });
    expect(overview).not.toHaveProperty("previousWork");

    const homeContent = selectHomeContent(content);
    expect(homeContent.experience.map((item) => item.id)).toEqual(["experience-home"]);
    expect(homeContent.research.map((item) => item.id)).toEqual(["research-home"]);
    expect(homeContent.education.map((item) => item.id)).toEqual(["education-home"]);
    expect(homeContent.profileOverview.currentWork?.id).toBe("experience-home");
    expect(homeContent.profileOverview.research?.id).toBe("research-home");
    expect(homeContent.profileOverview.education?.id).toBe("education-selected");
  });

  it("honors only a current explicit work row and otherwise ranks current Home candidates", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);
    const baseExperience = content.experience[0]!;
    const currentExperience = [
      {
        ...baseExperience,
        id: "experience-ended",
        endDate: "2025-08",
        featured: true,
        showOnHome: true,
        homeOrder: 1
      },
      {
        ...baseExperience,
        id: "experience-home-later",
        endDate: "Present",
        featured: true,
        showOnHome: true,
        homeOrder: 9
      },
      {
        ...baseExperience,
        id: "experience-home-first",
        endDate: "Current",
        homeSummary: "Selected current summary.",
        featured: true,
        showOnHome: true,
        homeOrder: 2
      },
      {
        ...baseExperience,
        id: "experience-current-hidden",
        endDate: "",
        featured: false,
        showOnHome: false,
        homeOrder: 1
      }
    ];

    expect(getCurrentExperience(currentExperience, "experience-ended")?.id).toBe("experience-home-first");
    expect(getCurrentExperience(currentExperience, "experience-current-hidden")?.id).toBe("experience-current-hidden");
    expect(getCurrentExperience(currentExperience.filter((item) => item.id === "experience-ended"))).toBeUndefined();

    content.profile.currentExperienceId = "experience-ended";
    content.profile.currentTitle = "Profile fallback title";
    content.profile.currentCompany = "Profile fallback company";
    content.experience = currentExperience.filter((item) => item.id === "experience-ended");

    expect(createProfileOverviewContent(content).currentWork).toMatchObject({
      id: undefined,
      title: "Profile fallback title",
      organization: "Profile fallback company",
      summary: undefined
    });
  });

  it("selects one Home research item before the safe no-show fallback", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);
    const baseResearch = content.research[0]!;
    const research = [
      { ...baseResearch, id: "research-home-unfeatured", featured: false, showOnHome: true, homeOrder: 1 },
      { ...baseResearch, id: "research-home-later", featured: true, showOnHome: true, homeOrder: 9 },
      { ...baseResearch, id: "research-home-first", featured: true, showOnHome: true, homeOrder: 2 },
      { ...baseResearch, id: "research-explicit", featured: true, showOnHome: false, homeOrder: 1 }
    ];

    expect(getSelectedResearch(research, "research-explicit")?.id).toBe("research-home-first");

    const noHomeResearch = research.map((item) => ({ ...item, showOnHome: false }));
    expect(getSelectedResearch(noHomeResearch, "research-explicit")?.id).toBe("research-explicit");
    expect(getSelectedResearch(noHomeResearch, "missing")?.id).toBe("research-explicit");
    expect(getSelectedResearch([], "missing")).toBeUndefined();
  });

  it("selects primary education explicitly, then uses a safe Home fallback and compact graduation label", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);
    const baseEducation = content.education[0]!;
    const education = [
      { ...baseEducation, id: "education-home", institution: "Home University", featured: true, showOnHome: true, homeOrder: 2 },
      { ...baseEducation, id: "education-explicit", institution: "Explicit University", featured: false, showOnHome: false }
    ];

    const selectedExplicitEducation = getPrimaryEducation(education, { ...profile, primaryEducationId: "education-explicit" });
    const selectedHomeEducation = getPrimaryEducation(education, { ...profile, primaryEducationId: "missing" });
    const selectedProfileEducation = getPrimaryEducation([], profile);

    expect(selectedExplicitEducation?.institution).toBe("Explicit University");
    expect(selectedHomeEducation?.institution).toBe("Home University");
    expect(selectedProfileEducation?.institution).toBe("Profile University");
    expect(getEducationDisplayLabel(selectedProfileEducation!)).toBe("BS in Computer Science / Jun 2025");
    expect(formatCompactGraduationDate("2025-06")).toBe("Graduated Jun 2025");
    expect(formatCompactGraduationDate(undefined)).toBeUndefined();
  });

  it("keeps only valid research links and exposes Home logo and pending resources", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);
    const selectedResearch = content.research[0]!;
    content.research = [
      {
        ...selectedResearch,
        links: [
          { label: "Live site", url: "https://example.com/live" },
          { label: "Unsafe", url: "javascript:alert(1)" },
          { label: "", url: "https://example.com/unlabelled" },
          { label: "Codebase", url: "/research/source" }
        ],
        pendingLinks: ["Manuscript"],
        organization: "Repeated organization",
        organizationLogo: "/images/organizations/repeated.svg",
        organizationLogoAlt: "Repeated organization mark"
      }
    ];

    const researchOverview = createProfileOverviewContent(content).research;

    expect(researchOverview?.links).toEqual([
      { label: "Live site", url: "https://example.com/live" },
      { label: "Codebase", url: "/research/source" }
    ]);
    expect(researchOverview?.pendingLinks).toEqual(["Manuscript"]);
    expect(researchOverview?.logo).toEqual({
      src: "/images/organizations/repeated.svg",
      alt: "Repeated organization mark"
    });
    expect(researchOverview).not.toHaveProperty("organization");
  });

  it("handles missing optional overview data without crashing", () => {
    const overview = createProfileOverviewContent({
      profile: {
        fullName: "Demo Person",
        headline: "  Systems builder.  ",
        location: "City State",
        email: "demo@example.com",
        shortBio: ""
      },
      experience: [],
      research: [],
      education: []
    });

    expect(overview.greetingName).toBe("Demo");
    expect(overview.role).toEqual({ kind: "static", label: "Systems builder." });
    expect(overview.about).toBeUndefined();
    expect(overview.currentWork).toBeUndefined();
    expect(overview.education).toBeUndefined();
    expect(overview.research).toBeUndefined();
    expect(overview).not.toHaveProperty("previousWork");
  });

  it("selects profile contact links in recruiter-friendly order with safe fallbacks", () => {
    const links = [
      {
        id: "linkedin",
        label: "LinkedIn",
        url: "https://www.linkedin.com/in/demo",
        kind: "linkedin",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true
      },
      {
        id: "github",
        label: "GitHub",
        url: "https://github.com/demo",
        kind: "github",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true
      },
      {
        id: "portfolio",
        label: "Portfolio",
        url: "https://demo.example",
        kind: "portfolio",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true
      }
    ];

    expect(getProfileContactLinks(links, profile).map((link) => link.label)).toEqual(["GitHub", "LinkedIn", "Email", "Resume", "Portfolio"]);
    expect(getProfileContactLinks([], profile).map((link) => link.label)).toEqual(["Email", "Resume"]);
  });

  it("creates compact identity rail items from profile facts and primary links", () => {
    const links = [
      {
        id: "github",
        label: "GitHub",
        url: "https://github.com/demo",
        kind: "github",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true
      },
      {
        id: "linkedin",
        label: "LinkedIn",
        url: "https://www.linkedin.com/in/demo-person",
        kind: "linkedin",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true
      },
      {
        id: "email",
        label: "Email",
        url: "mailto:demo@example.com",
        kind: "email",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true
      },
      {
        id: "portfolio",
        label: "Portfolio",
        url: "https://demo.example/",
        kind: "portfolio",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true
      }
    ];

    expect(getProfileIdentityItems(profile, links).map((item) => item.label)).toEqual([
      "City State",
      "Pacific Time (UTC-07:00)",
      "demo@example.com",
      "https://demo.example",
      "in/demo-person",
      "@demo"
    ]);
  });

  it("uses short bio before creating a long bio excerpt", () => {
    expect(createShortAboutText(profile)).toBe("Short biography.");
    expect(
      createShortAboutText({
        ...profile,
        shortBio: "",
        longBio: "This is a longer biography that can safely become a concise excerpt when the short biography field is unavailable."
      })
    ).toMatch(/^This is a longer biography/);
  });
});

describe("content selection and sorting", () => {
  it("shows only explicitly enabled links in the header", () => {
    const content = normalizePortfolioContent(
      createSheets({
        links: [
          {
            id: "github",
            label: "GitHub",
            url: "https://github.com/example",
            icon: "github",
            kind: "github",
            is_primary: "true",
            show_on_home: "true",
            show_in_header: "true",
            show_in_footer: "true",
            order: "1"
          },
          {
            id: "resume",
            label: "Resume",
            url: "/resume/demo.pdf",
            icon: "file",
            kind: "resume",
            is_primary: "false",
            show_on_home: "true",
            show_in_header: "false",
            show_in_footer: "true",
            order: "2"
          }
        ]
      }),
      metadata
    );

    expect(selectHeaderLinks(content.links).map((link) => link.id)).toEqual(["github"]);
  });

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

  it("selects limited Home content from settings for concise card types", () => {
    const content = normalizePortfolioContent(createSheets(), metadata);
    const homeContent = selectHomeContent(content);

    expect(homeContent.research).toHaveLength(1);
    expect(homeContent.projects).toHaveLength(1);
    expect(homeContent.experience).toHaveLength(1);
    expect(homeContent.recommendations).toHaveLength(1);
    expect(homeContent.skillGroups.flatMap((group) => group.skills)).toHaveLength(2);
  });

  it("keeps every spreadsheet-enabled experience row on Home", () => {
    const content = normalizePortfolioContent(
      createSheets({
        experience: [
          {
            id: "experience-first",
            title: "First role",
            organization: "Company A",
            featured: "false",
            show_on_home: "true",
            home_order: "1",
            detail_order: "1"
          },
          {
            id: "experience-second",
            title: "Second role",
            organization: "Company B",
            featured: "false",
            show_on_home: "true",
            home_order: "2",
            detail_order: "2"
          },
          {
            id: "experience-third",
            title: "Third role",
            organization: "Company C",
            featured: "false",
            show_on_home: "true",
            home_order: "3",
            detail_order: "3"
          },
          {
            id: "experience-hidden",
            title: "Hidden role",
            organization: "Company D",
            featured: "false",
            show_on_home: "false",
            home_order: "4",
            detail_order: "4"
          }
        ]
      }),
      metadata
    );

    expect(content.siteSettings.maxHomeExperienceItems).toBe(1);
    expect(selectHomeContent(content).experience.map((item) => item.id)).toEqual([
      "experience-first",
      "experience-second",
      "experience-third"
    ]);
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
