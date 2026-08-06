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
        organization_logo: "/images/research/lab.svg",
        organization_logo_alt: "Lab mark",
        location: "Remote",
        start_date: "2025-01",
        end_date: "Present",
        home_summary: "Home research.",
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
      { key: "max_home_skill_items", value: "2" }
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
    expect(content.research[0]?.pendingLinks).toEqual(["Manuscript"]);
    expect(content.projects[0]?.stack).toEqual(["TypeScript", "Next.js"]);
    expect(content.experience[0]?.organizationLogo).toBe("/images/experience/company.svg");
    expect(content.experience[0]?.organizationLogoAlt).toBe("Company mark");
    expect(content.recommendations[0]?.skills).toEqual(["Communication", "TypeScript"]);
    expect(content.education[0]?.institutionLogo).toBe("/images/education/university-logo.svg");
    expect(content.education[0]?.institutionLogoAlt).toBe("University logo");
    expect(content.education[0]?.concentration).toBe("Information Assurance");
    expect(content.siteSettings.enableRecommendations).toBe(true);
    expect(content.siteSettings.showEmptyRecommendations).toBe(false);
    expect(content.siteSettings.defaultTheme).toBe("navy");
    expect(content.siteSettings.maxHomeRecommendationItems).toBe(1);
    expect(content.siteSettings.recommendationsNavLabel).toBe("Recommendations");
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
        title: featuredResearch!.title,
        summary: featuredResearch!.homeSummary ?? featuredResearch!.detailSummary,
        links: featuredResearch!.links
      });
      expect(overview.research).not.toHaveProperty("pendingLinks");
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

    expect(overview.headline).toBe(content.profile.headline);
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
      links: "Live Sentinel=https://example.com/live-sentinel|Source Sentinel=https://github.com/example/source-sentinel",
      pending_links: "Manuscript Sentinel",
      featured: "false",
      show_on_home: "false"
    });

    const content = normalizePortfolioContent(sheets, metadata);
    const overview = createProfileOverviewContent(content);

    expect(overview).toEqual({
      headline: "CSV Headline Sentinel.",
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
        summary: "CSV Research Summary Sentinel.",
        links: [
          { label: "Live Sentinel", url: "https://example.com/live-sentinel" },
          { label: "Source Sentinel", url: "https://github.com/example/source-sentinel" }
        ]
      }
    });
    expect(content.profile.previousExperienceId).toBe("experience-previous-sentinel");
    expect(content.experience.some((item) => item.id === content.profile.previousExperienceId)).toBe(true);
    expect(content.research.find((item) => item.id === "research-sentinel")?.pendingLinks).toEqual(["Manuscript Sentinel"]);
    expect(overview).not.toHaveProperty("previousWork");
    expect(overview.research).not.toHaveProperty("pendingLinks");
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

    expect(overview.headline).toBe("Profile headline");
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
      summary: baseResearch.homeSummary,
      links: baseResearch.links
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

  it("keeps only valid research links and omits pending or organization metadata from the Home model", () => {
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
        organizationLogo: "/images/organizations/repeated.svg"
      }
    ];

    const researchOverview = createProfileOverviewContent(content).research;

    expect(researchOverview?.links).toEqual([
      { label: "Live site", url: "https://example.com/live" },
      { label: "Codebase", url: "/research/source" }
    ]);
    expect(researchOverview).not.toHaveProperty("pendingLinks");
    expect(researchOverview).not.toHaveProperty("organization");
    expect(researchOverview).not.toHaveProperty("logo");
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

    expect(overview.headline).toBe("Systems builder.");
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
