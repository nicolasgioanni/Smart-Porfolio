import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  ExperienceItem,
  GeneratedPortfolioContent,
  HomePortfolioContent,
  ProfileOverviewContent,
  ProjectItem,
  RecommendationItem,
  ResearchItem,
  SkillGroup
} from "@/content/types";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { BlobFooter } from "@/components/layout/BlobFooter";
import { PageIntro } from "@/components/layout/PageIntro";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { HomeEducationSummary } from "@/components/portfolio/HomeEducationSummary";
import { HomeFeaturedExperience } from "@/components/portfolio/HomeFeaturedExperience";
import { HomeFeaturedProjects } from "@/components/portfolio/HomeFeaturedProjects";
import { HomeFeaturedResearch } from "@/components/portfolio/HomeFeaturedResearch";
import { HomeOverview } from "@/components/portfolio/HomeOverview";
import { HomeRecommendations } from "@/components/portfolio/HomeRecommendations";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { RecommendationsList } from "@/components/portfolio/RecommendationsList";
import { ResearchList } from "@/components/portfolio/ResearchList";
import { createProfileOverviewContent } from "@/lib/content/profileOverview";

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

const skillGroup: SkillGroup = {
  category: "Core Programming",
  order: 1,
  skills: [
    ["python", "Python", "python"],
    ["c-cpp", "C/C++", "cplusplus"],
    ["typescript-javascript", "TypeScript / JavaScript", "typescript"],
    ["sql", "SQL", "database"]
  ].map(([id, name, icon], index) => ({
    id,
    category: "Core Programming",
    categoryOrder: 1,
    name,
    icon,
    proficiency: name === "Python" ? "Advanced" : "Proficient",
    summary: `${name} supports reliable software development.`,
    whereUsed: `${name} was applied in portfolio projects and research.`,
    featured: false,
    showOnHome: true,
    order: index + 1
  }))
};

const homeProject: ProjectItem = {
  id: "notepal",
  title: "NotePal",
  subtitle: "Multimodal study workspace",
  homeSummary: "Turns learning material into notes, quizzes, and content-aware chat support.",
  homeSkills: [
    {
      name: "Next.js",
      icon: "nextdotjs",
      summary: "Next.js powers the interface.",
      details: "It provides the routed study workspace."
    },
    {
      name: "TypeScript",
      icon: "typescript",
      summary: "TypeScript keeps frontend data typed.",
      details: "It types components, state, and API payloads."
    },
    {
      name: "OpenAI API",
      icon: "openai",
      summary: "OpenAI models generate study material.",
      details: "They create notes, quizzes, and content-aware chat responses."
    }
  ],
  stack: ["Next.js", "TypeScript", "OpenAI API"],
  links: [
    { label: "Source code", url: "https://github.com/example/notepal" },
    { label: "Live demo", url: "https://example.com/notepal" }
  ],
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
      currentTitle: "Research Assistant",
      currentCompany: "Example Lab",
      location: "City State",
      timezone: "Pacific Time (UTC-07:00)",
      email: "nicolas@example.com",
      university: "Profile University",
      degree: "BS",
      fieldOfStudy: "Computer Science",
      graduation: "Jun 2025",
      shortBio: "Short bio.",
      resumeUrl: "/resume/demo.pdf"
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
        id: "linkedin",
        label: "LinkedIn",
        url: "https://www.linkedin.com/in/example",
        kind: "linkedin",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true,
        order: 2
      },
      {
        id: "email",
        label: "Email",
        url: "mailto:nicolas@example.com",
        kind: "email",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true,
        order: 3
      },
      {
        id: "portfolio",
        label: "Portfolio",
        url: "https://example.com",
        kind: "portfolio",
        isPrimary: true,
        showOnHome: true,
        showInHeader: true,
        showInFooter: true,
        order: 4
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
        order: 5
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
      defaultTheme: "navy",
      enableSkeletons: true,
      enableScrollMotion: false,
      enableGlassEffects: true,
      enableRecommendations: true,
      showEmptyRecommendations: true,
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

function createHomeContent(
  recommendations: RecommendationItem[] = [],
  skillGroups: SkillGroup[] = []
): HomePortfolioContent {
  const content = createFooterContent();

  return {
    profile: content.profile,
    profileOverview: createProfileOverviewContent(content),
    links: content.links,
    research: [],
    projects: [],
    experience: [],
    recommendations,
    education: [],
    skillGroups,
    resume: [],
    siteSettings: content.siteSettings
  };
}

describe("portfolio UI helpers", () => {
  it("renders reusable page and section headers", () => {
    const { container } = render(
      <>
        <SectionHeader actionHref="/projects" actionLabel="View projects" description="Selected work." eyebrow="Projects" title="Engineering projects" />
        <PageIntro description="Resume details." motionEnabled={false} title="Resume" variant="panel" />
      </>
    );

    expect(screen.getByRole("heading", { name: "Engineering projects" })).toBeInTheDocument();
    expect(screen.getByText("Selected work.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view projects/i })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("heading", { level: 1, name: "Resume" })).toBeInTheDocument();
    expect(screen.getByText("Resume details.")).toBeInTheDocument();
    expect(container.querySelector(".page-intro .eyebrow")).not.toBeInTheDocument();
    expect(container.querySelector(".page-intro__surface")).toHaveClass("glass-surface", "glass-surface--strong");
  });

  it("renders accessible empty states", () => {
    render(<EmptyState message="No rows yet." title="Missing content" />);

    expect(screen.getByRole("status")).toHaveTextContent("Missing content");
    expect(screen.getByRole("status")).toHaveTextContent("No rows yet.");
  });

  it("renders Home education as a simple spreadsheet-backed academic history", () => {
    const { container } = render(
      <HomeEducationSummary
        items={[
          {
            id: "education-a",
            institution: "Example University",
            institutionLogo: "/images/organizations/example-university.svg",
            institutionLogoAlt: "Example University mark",
            degree: "BS",
            field: "Computer Science",
            concentration: "Information Assurance",
            location: "City State",
            startDate: "2022-09",
            endDate: "2026-05",
            homeSummary: "Focused on systems.",
            detailSummary: "Focused on systems and engineering.",
            bullets: ["GPA: 3.9/4.0", "Dean's List: 2022–2026", "Relevant coursework: Algorithms"],
            featured: true,
            showOnHome: true,
            homeOrder: 1,
            detailOrder: 1
          },
          {
            id: "education-b",
            institution: "Cascadia College",
            degree: "Running Start",
            field: "Computer Science",
            startDate: "2020-09",
            endDate: "2022-06",
            bullets: [],
            featured: false,
            showOnHome: true,
            homeOrder: 2,
            detailOrder: 2
          }
        ]}
      />
    );

    expect(container.querySelectorAll(".home-education-item")).toHaveLength(2);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Example University",
      "Cascadia College"
    ]);
    expect(screen.getByRole("img", { name: "Example University mark" })).toHaveAttribute(
      "src",
      "/images/organizations/example-university.svg"
    );
    expect(container.querySelectorAll(".home-education-item__mark--image")).toHaveLength(1);
    expect(container.querySelector(".home-education-item__initials")?.parentElement).not.toHaveClass(
      "home-education-item__mark--image"
    );
    expect(container.querySelector(".home-education-item__initials")).toHaveTextContent("CC");
    expect(screen.getByText("BS in Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Sep 2022 – May 2026")).toBeInTheDocument();
    expect(screen.getByText("City State")).toBeInTheDocument();
    expect(screen.getByText("Concentration: Information Assurance")).toBeInTheDocument();
    expect(screen.queryByText("Focused on systems.")).not.toBeInTheDocument();

    const educationContent = container.querySelector<HTMLElement>(".home-education-item__content");
    expect(Array.from(educationContent!.children).map((element) => element.className)).toEqual([
      "home-education-item__institution",
      "home-education-item__program",
      "home-education-item__concentration",
      "home-education-item__dates",
      "home-education-item__location",
      "home-education-item__details"
    ]);

    const educationDetails = screen.getByRole("list", { name: "Example University education details" });
    expect(within(educationDetails).getByText("GPA: 3.9/4.0")).toBeInTheDocument();
    expect(within(educationDetails).getByText("Dean's List: 2022–2026")).toBeInTheDocument();
    expect(within(educationDetails).getByText("Relevant coursework: Algorithms")).toBeInTheDocument();
    expect(container.querySelector(".portfolio-card")).not.toBeInTheDocument();
    expect(container.querySelector(".glass-chip")).not.toBeInTheDocument();
  });

  it("renders Home experience as a concise spreadsheet-backed work history", () => {
    const items: ExperienceItem[] = [
      {
        id: "research-current",
        title: "Research Assistant",
        organization: "Example University",
        organizationLogo: "/images/organizations/example.svg",
        organizationLogoAlt: "Example University logo",
        type: "research",
        location: "Seattle, WA",
        startDate: "2025-01",
        endDate: "Present",
        homeSummary: "Summary that should stay hidden.",
        bullets: ["Bullet that should stay hidden."],
        skills: ["Python"],
        featured: true,
        showOnHome: true
      },
      {
        id: "research-previous",
        title: "Undergraduate Researcher",
        organization: "Example University",
        location: "Bothell, WA",
        startDate: "2024-09",
        endDate: "2024-12",
        bullets: [],
        skills: [],
        featured: false,
        showOnHome: true
      },
      {
        id: "officer",
        title: "Officer",
        organization: "Developer Group",
        location: "Bothell, WA",
        startDate: "2024-01",
        endDate: "2024-06",
        bullets: [],
        skills: [],
        featured: false,
        showOnHome: true
      }
    ];

    const { container } = render(<HomeFeaturedExperience items={items} />);

    expect(container.querySelectorAll(".home-experience-group")).toHaveLength(2);
    expect(container.querySelectorAll(".home-experience-role")).toHaveLength(3);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Example University",
      "Developer Group"
    ]);
    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual([
      "Research Assistant",
      "Undergraduate Researcher",
      "Officer"
    ]);
    expect(screen.getByRole("img", { name: "Example University logo" })).toHaveAttribute(
      "src",
      "/images/organizations/example.svg"
    );
    expect(container.querySelectorAll(".home-experience-group__mark--image")).toHaveLength(1);
    expect(container.querySelector(".home-experience-group__initials")?.parentElement).not.toHaveClass(
      "home-experience-group__mark--image"
    );
    expect(screen.getByText("Jan 2025 \u2013 Present")).toBeInTheDocument();
    expect(screen.getByText("Sep 2024 \u2013 Dec 2024")).toBeInTheDocument();
    expect(screen.getAllByText("Bothell, WA")).toHaveLength(2);
    expect(screen.queryByText("research", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Featured", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Summary that should stay hidden.")).not.toBeInTheDocument();
    expect(screen.queryByText("Bullet that should stay hidden.")).not.toBeInTheDocument();
    expect(screen.queryByText("Python", { exact: true })).not.toBeInTheDocument();
  });

  it("renders three concise Home research cards with ordered verified actions", () => {
    const items: ResearchItem[] = [
      {
        id: "cytocv-miller-lab",
        title: "CytoCV: Web-based platform for reproducible yeast microscopy image analysis",
        role: "Graduate Research",
        organization: "UW Bothell School of STEM",
        location: "Bothell, Washington, United States",
        startDate: "2024-08",
        endDate: "Present",
        homeSummary: "A one-line research explanation.",
        profileSummary: "Compact profile-only research copy.",
        detailSummary: "A longer detail explanation.",
        impact: "Impact that should stay hidden.",
        bullets: ["Detail that should stay hidden."],
        skills: ["Python"],
        links: [
          { label: "Live demo", url: "https://example.com/demo" },
          { label: "Manuscript", url: "https://example.com/manuscript" },
          { label: "Source code", url: "https://github.com/example/cytocv" }
        ],
        pendingLinks: ["Dataset"],
        featured: true,
        showOnHome: true
      },
      {
        id: "adversarial-machine-learning",
        title: "Adversarial Machine Learning: Analysis of Causative Attacks against SVMs Learning from Data Streams",
        organization: "UW Bothell School of STEM",
        location: "Bothell, Washington, United States",
        startDate: "2024-09",
        endDate: "2024-12",
        homeSummary: "A second one-line research explanation.",
        bullets: [],
        skills: [],
        links: [
          { label: "Source code", url: "https://github.com/example/adversarial-ml" },
          { label: "Manuscript", url: "https://example.com/adversarial-ml-manuscript" }
        ],
        featured: false,
        showOnHome: true
      },
      {
        id: "yeast-dna-target-selection",
        title: "Guide Donor Scheduler: Yeast DNA target selection automation",
        organization: "UW Bothell School of STEM",
        location: "Bothell, Washington, United States",
        startDate: "2024-03",
        endDate: "2024-08",
        homeSummary: "A third one-line research explanation.",
        bullets: [],
        skills: [],
        links: [{ label: "Source code", url: "https://github.com/example/guide-donor-scheduler" }],
        featured: false,
        showOnHome: true
      }
    ];

    const { container } = render(<HomeFeaturedResearch items={items} />);
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".home-research-card"));

    expect(container.querySelector(".featured-grid")).toHaveClass("featured-grid--three");
    expect(cards).toHaveLength(3);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(items.map((item) => item.title));
    expect(screen.getAllByText("UW Bothell School of STEM")).toHaveLength(3);
    expect(screen.getByText("Aug 2024 \u2013 Present")).toBeInTheDocument();
    expect(screen.getAllByText("Bothell, Washington, United States")).toHaveLength(3);
    expect(screen.getByText("A one-line research explanation.")).toBeInTheDocument();
    expect(screen.queryByText("Compact profile-only research copy.")).not.toBeInTheDocument();
    expect(screen.queryByText("A longer detail explanation.")).not.toBeInTheDocument();
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
    expect(within(cards[0]).getAllByRole("link").map((link) => link.textContent)).toEqual(["Source code", "Manuscript", "Live demo"]);
    expect(within(cards[0]).getByRole("link", { name: `Source code for ${items[0].title}` })).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
    expect(within(cards[1]).getAllByRole("link").map((link) => link.textContent)).toEqual(["Source code", "Manuscript"]);
    expect(within(cards[2]).getAllByRole("link").map((link) => link.textContent)).toEqual(["Source code"]);
    expect(screen.queryByRole("link", { name: /learn more/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Dataset")).not.toBeInTheDocument();
    expect(screen.queryByText("Graduate Research")).not.toBeInTheDocument();
    expect(screen.queryByText("Impact that should stay hidden.")).not.toBeInTheDocument();
    expect(screen.queryByText("Detail that should stay hidden.")).not.toBeInTheDocument();
    expect(screen.queryByText("Python", { exact: true })).not.toBeInTheDocument();
  });

  it("adds stable fragment targets to Research detail cards", () => {
    const item: ResearchItem = {
      id: "research-fragment",
      title: "Research fragment",
      bullets: [],
      skills: [],
      links: [],
      featured: false,
      showOnHome: true
    };

    const { container } = render(<ResearchList items={[item]} variant="detail" />);

    expect(container.querySelector(".research-card")).toHaveAttribute("id", "research-fragment");
  });

  it("renders Home projects with plain subtitles, three exact skills, and relevant actions", () => {
    const { container } = render(<HomeFeaturedProjects items={[homeProject]} />);
    const card = container.querySelector<HTMLElement>(".home-project-card");

    expect(card).toBeInTheDocument();
    expect(within(card!).getByRole("heading", { name: "NotePal" })).toBeInTheDocument();
    expect(within(card!).getByText("Multimodal study workspace")).toHaveClass("home-project-card__subtitle");
    expect(within(card!).queryByText("Featured")).not.toBeInTheDocument();
    expect(card!.querySelector(".project-skill-showcase")).toBeInTheDocument();
    expect(card!.querySelectorAll(".project-skill-showcase__trigger")).toHaveLength(3);
    expect(
      Array.from(card!.querySelectorAll(".project-skill-showcase__trigger .skill-badge__label")).map(
        (label) => label.textContent
      )
    ).toEqual(["Next.js", "TypeScript", "OpenAI API"]);
    expect(within(card!).getAllByRole("link").map((link) => link.textContent)).toEqual(["Source code", "Live demo"]);
  });

  it("marks single item grids for intentional layouts", () => {
    const { container } = render(
      <FeaturedGrid itemCount={1}>
        <article>Only item</article>
      </FeaturedGrid>
    );

    expect(container.firstElementChild).toHaveClass("featured-grid--single");
  });

  it("renders recommendation empty and populated states", () => {
    const { container, rerender } = render(<RecommendationsList items={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("No recommendations yet");

    rerender(<RecommendationsList items={[recommendation]} />);

    expect(screen.getByText("Alex Manager")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on linkedin/i })).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.querySelector(".recommendation-expandable")).toHaveAttribute("data-collapsed-lines", "4");
  });

  it("passes a structured inline quote link through recommendation cards", () => {
    const linkedRecommendation: RecommendationItem = {
      ...recommendation,
      fullQuote: "A thoughtful engineer who made CytoCV easier to use.",
      fullQuoteLink: {
        label: "CytoCV",
        url: "https://github.com/BrentLagesse/CytoCV"
      }
    };
    const { container } = render(<RecommendationsList items={[linkedRecommendation]} />);
    const link = screen.getByRole("link", { name: "CytoCV" });

    expect(container.querySelector("blockquote")).toHaveTextContent(linkedRecommendation.fullQuote);
    expect(link).toHaveAttribute("href", "https://github.com/BrentLagesse/CytoCV");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders full Home recommendations with a detail route link", () => {
    const { container } = render(<HomeRecommendations items={[recommendation]} />);

    expect(screen.getByText(recommendation.fullQuote)).toBeInTheDocument();
    expect(screen.getByText("Engineering Manager at Example Company")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see all recommendations/i })).toHaveAttribute("href", "/recommendations");
    expect(container.querySelector(".recommendation-expandable")).toHaveAttribute("data-collapsed-lines", "4");
  });

  it("expands only the selected recommendation card", () => {
    const repeatedQuote = `${recommendation.fullQuote} ${recommendation.fullQuote} ${recommendation.fullQuote}`;
    const recommendations = [
      { ...recommendation, fullQuote: repeatedQuote },
      {
        ...recommendation,
        id: "recommendation-b",
        recommenderName: "Jordan Peer",
        fullQuote: repeatedQuote,
        linkedinUrl: "https://www.linkedin.com/in/jordan-peer/details/recommendations/"
      }
    ];
    const { container } = render(<HomeRecommendations items={recommendations} showAction={false} />);
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".recommendation-card"));
    const expanders = Array.from(container.querySelectorAll<HTMLElement>(".recommendation-expandable"));

    expect(cards).toHaveLength(2);
    expect(expanders.map((expander) => expander.dataset.expanded)).toEqual(["false", "false"]);

    const firstToggle = within(cards[0]!).getByRole("button", {
      name: /show more recommendation from alex manager/i
    });
    fireEvent.click(firstToggle);

    expect(expanders.map((expander) => expander.dataset.expanded)).toEqual(["true", "false"]);
    expect(within(cards[1]!).getByRole("button", { name: /show more recommendation from jordan peer/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    fireEvent.click(firstToggle);
    expect(expanders.map((expander) => expander.dataset.expanded)).toEqual(["false", "false"]);
  });

  it("renders Home major sections without repetitive card eyebrows", () => {
    const { container } = render(<HomeOverview content={createHomeContent([], [skillGroup])} />);
    const overviewGrid = container.querySelector<HTMLElement>(".home-overview-grid");
    const skillsSection = container.querySelector<HTMLElement>(".home-section--skills");
    const recommendationsSection = container.querySelector<HTMLElement>(".home-section--recommendations");

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Experience" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommendations" })).toBeInTheDocument();
    expect(within(overviewGrid!).getByRole("heading", { name: "Education" })).toBeInTheDocument();
    expect(container.querySelector(".home-overview-grid .eyebrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected roles showing engineering, research, teaching, and leadership context.")).not.toBeInTheDocument();
    expect(screen.queryByText("Academic context and concise supporting details.")).not.toBeInTheDocument();
    expect(screen.queryByText("Research highlights summarized for quick scanning, with deeper technical context one click away.")).not.toBeInTheDocument();
    const sectionActions = [
      ["View Experience", "/experience"],
      ["View Research", "/research"],
      ["View Projects", "/projects"],
      ["View Recommendations", "/recommendations"]
    ] as const;

    for (const [label, href] of sectionActions) {
      const action = screen.getByRole("link", { name: label });
      expect(action).toHaveAttribute("href", href);
      expect(action).toHaveClass("glass-button", "section-header__action-button");
      expect(action).toHaveTextContent(/^View$/);
      expect(action.querySelector(".glass-link__arrow")).not.toBeInTheDocument();
      expect(action.closest(".section-header")).toHaveClass("section-header--button-action");
    }

    expect(screen.queryByRole("heading", { name: "Resume and contact" })).not.toBeInTheDocument();
    expect(within(skillsSection!).getByRole("heading", { name: "Core Programming" })).toBeInTheDocument();
    expect(skillsSection?.querySelectorAll(".skill-badge")).toHaveLength(4);
    expect(within(skillsSection!).getAllByRole("button", { name: /learn about my experience with/i })).toHaveLength(4);
    expect(within(recommendationsSection!).getByRole("status")).toHaveTextContent("No recommendations yet");
    expect(screen.queryByRole("link", { name: /see all recommendations/i })).not.toBeInTheDocument();
  });

  it("renders each Home section in the requested order even when recommendations exist", () => {
    const { container } = render(<HomeOverview content={createHomeContent([recommendation])} />);

    expect(Array.from(container.querySelectorAll(".home-overview-grid h2")).map((heading) => heading.textContent)).toEqual([
      "Experience",
      "Education",
      "Research",
      "Projects",
      "Skills",
      "Recommendations"
    ]);
  });

  it("renders portfolio-first hero copy without implementation labels", () => {
    const content = createFooterContent();
    const { container } = render(
      <PortfolioHero
        links={content.links}
        motionEnabled={false}
        overview={createProfileOverviewContent(content)}
        profile={content.profile}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Hi, I’m Nicolas" })).toBeInTheDocument();
    expect(screen.getByText("Nicolas Gioanni")).toHaveClass("profile-overview__identity-name");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "About",
      "Current Work",
      "Education"
    ]);
    expect(screen.queryByRole("heading", { name: "Headline" })).not.toBeInTheDocument();
    expect(container.querySelector(".profile-role__accessible")).toHaveTextContent("Software engineer");
    expect(screen.getAllByText("City State").length).toBeGreaterThan(0);
    expect(screen.getByText("Pacific Time (UTC-07:00)")).toBeInTheDocument();
    expect(screen.getByText("Research Assistant")).toBeInTheDocument();
    expect(screen.getByText("Example Lab")).toBeInTheDocument();
    expect(screen.getByText("Profile University")).toBeInTheDocument();
    expect(screen.getByText("Degree")).toBeInTheDocument();
    expect(screen.getByText("BS in Computer Science")).toBeInTheDocument();
    expect(screen.queryByText("Computer Science")).not.toBeInTheDocument();
    expect(screen.getByText("Graduated Jun 2025")).toBeInTheDocument();
    expect(screen.queryByText(/currently/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current focus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/smart portfolio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/spreadsheet driven/i)).not.toBeInTheDocument();
  });

  it("keeps role rotation enabled when scroll reveal motion is disabled", () => {
    const content = createFooterContent();
    const overview: ProfileOverviewContent = {
      greetingName: "Nicolas",
      role: {
        kind: "rotating",
        engineerPrefixes: ["Software", "AI", "Security"],
        engineerSuffix: "Engineer",
        alternate: "Research Scientist"
      }
    };

    const { container } = render(
      <PortfolioHero
        links={content.links}
        motionEnabled={false}
        overview={overview}
        profile={content.profile}
      />
    );

    expect(container.querySelector(".profile-role")).toHaveAttribute("data-motion-enabled", "true");
    expect(container.querySelector(".profile-role__accessible")).toHaveTextContent("Software Engineer");
  });

  it("renders the recruiter-focused profile hierarchy from prop-supplied content", () => {
    const content = createFooterContent();
    const profile = {
      ...content.profile,
      portraitImage: "/images/profile/nicolas.png"
    };
    const overview: ProfileOverviewContent = {
      greetingName: "Nico",
      role: { kind: "static", label: "Profile role supplied through the overview prop." },
      about: "About copy supplied through the overview prop.",
      currentWork: {
        id: "current-sentinel",
        title: "Current Role Sentinel",
        organization: "Current Organization Sentinel",
        startDate: "2024-08",
        endDate: "Present",
        dateLabel: "Aug 2024 \u2013 Present",
        summary: "Current work summary supplied through the overview prop.",
        logo: { src: "/images/organizations/current-sentinel.svg", alt: "Current Organization Sentinel mark" }
      },
      education: {
        id: "education-sentinel",
        institution: "Education Institution Sentinel",
        degree: "Bachelor of Science",
        field: "Computer Science",
        concentration: "Information Assurance & Cybersecurity",
        location: "Education Location Sentinel",
        startDate: "2020-09",
        endDate: "2025-06",
        graduationLabel: "Graduated Jun 2025",
        logo: { src: "/images/organizations/education-sentinel.svg", alt: "Education Institution Sentinel mark" }
      },
      research: {
        id: "research-sentinel",
        title: "Research Project Sentinel",
        byline: "Lead Engineer & First Author",
        labs: ["SEE Lab, UW Bothell School of STEM", "Miller Lab, University of Utah"],
        logo: { src: "/images/organizations/research-sentinel.svg", alt: "Research Organization Sentinel mark" },
        links: [
          { label: "Live site", url: "https://example.com/research-live" },
          { label: "Source code", url: "https://github.com/example/research-source" }
        ],
        pendingLinks: ["Manuscript"]
      }
    };

    const { container } = render(
      <PortfolioHero
        links={content.links}
        motionEnabled={false}
        overview={overview}
        profile={profile}
      />
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const details = container.querySelector<HTMLElement>(".profile-overview__details");
    expect(details).not.toBeNull();
    expect(Array.from(details!.querySelectorAll("h1, h2")).map((element) => element.textContent)).toEqual([
      "Hi, I’m Nico",
      "About",
      "Current Work",
      "Education",
      "Research"
    ]);
    expect(screen.queryByRole("heading", { name: "Headline" })).not.toBeInTheDocument();
    expect(container.querySelector(".profile-role__accessible")).toHaveTextContent(
      "Profile role supplied through the overview prop."
    );
    expect(screen.queryByRole("heading", { name: "Previous Work" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Nicolas Gioanni" })).toHaveAttribute("src", "/images/profile/nicolas.png");
    expect(screen.getByText("City State")).toBeInTheDocument();
    expect(screen.getByText("About copy supplied through the overview prop.")).toBeInTheDocument();
    expect(screen.getByText("Pacific Time (UTC-07:00)")).toBeInTheDocument();

    const currentWorkSection = screen.getByRole("heading", { level: 2, name: "Current Work" }).closest("section");
    const educationSection = screen.getByRole("heading", { level: 2, name: "Education" }).closest("section");
    const researchSection = screen.getByRole("heading", { level: 2, name: "Research" }).closest("section");
    expect(currentWorkSection).toHaveAttribute("aria-labelledby", "profile-overview-current-work-heading");
    expect(educationSection).toHaveAttribute("aria-labelledby", "profile-overview-education-heading");
    expect(researchSection).toHaveAttribute("aria-labelledby", "profile-overview-research-heading");
    expect(currentWorkSection?.parentElement).toBe(details);
    expect(educationSection?.parentElement).toHaveClass("profile-overview__academic-grid");
    expect(researchSection?.parentElement).toBe(educationSection?.parentElement);

    const currentWork = within(currentWorkSection!);
    expect(currentWork.getByRole("heading", { level: 3, name: "Current Organization Sentinel" })).toBeInTheDocument();
    expect(currentWork.getByText("Current Role Sentinel")).toBeInTheDocument();
    expect(currentWork.getByText("Aug 2024 \u2013 Present")).toBeInTheDocument();
    expect(currentWork.getByText("Current work summary supplied through the overview prop.")).toBeInTheDocument();
    const experienceLink = currentWork.getByRole("link", { name: "View experience" });
    expect(experienceLink).toHaveAttribute("href", "/experience");
    expect(experienceLink).toHaveClass(
      "profile-overview__panel-action",
      "hover-base-1",
      "hover-base-1--compact",
      "hover-base-1--inline"
    );
    expect(experienceLink.parentElement).toHaveClass("profile-overview__panel-action-slot");
    expect(experienceLink.closest("header")).toHaveClass("profile-overview__panel-header--with-action");
    expect(experienceLink.querySelector(".glass-link__arrow")).not.toBeInTheDocument();

    const currentLogo = currentWorkSection?.querySelector<HTMLImageElement>('img[src="/images/organizations/current-sentinel.svg"]');
    expect(currentLogo).toHaveAttribute("alt", "");
    expect(currentLogo).toHaveAttribute("width", "48");
    expect(currentLogo).toHaveAttribute("height", "48");

    const education = within(educationSection!);
    expect(education.getByRole("heading", { level: 3, name: "Education Institution Sentinel" })).toBeInTheDocument();
    const educationDetails = educationSection!.querySelector("dl.profile-overview__academic-details");
    expect(educationDetails).not.toBeNull();
    expect(Array.from(educationDetails!.querySelectorAll("dt")).map((term) => term.textContent)).toEqual([
      "Degree",
      "Concentration"
    ]);
    expect(Array.from(educationDetails!.querySelectorAll("dd")).map((description) => description.textContent)).toEqual([
      "Bachelor of Science in Computer Science",
      "Information Assurance & Cybersecurity"
    ]);
    expect(education.queryByText("Bachelor of Science \u2014 Computer Science")).not.toBeInTheDocument();
    expect(education.queryByText("Concentration: Information Assurance & Cybersecurity")).not.toBeInTheDocument();
    const graduationDate = education.getByText("Graduated Jun 2025");
    expect(graduationDate).toHaveClass("profile-overview__metadata", "profile-overview__academic-footer");
    expect(education.queryByText("Education Location Sentinel")).not.toBeInTheDocument();
    expect(education.queryByText("Sep 2020 \u2013 Jun 2025")).not.toBeInTheDocument();
    expect(education.queryByRole("link")).not.toBeInTheDocument();

    const educationLogo = educationSection?.querySelector<HTMLImageElement>('img[src="/images/organizations/education-sentinel.svg"]');
    expect(educationLogo).toHaveAttribute("alt", "");
    expect(educationLogo).toHaveAttribute("width", "48");
    expect(educationLogo).toHaveAttribute("height", "48");

    const research = within(researchSection!);
    expect(research.getAllByRole("heading", { level: 3, name: "Research Project Sentinel" })).toHaveLength(1);
    const researchDetails = researchSection!.querySelector("dl.profile-overview__research-details");
    expect(researchDetails).not.toBeNull();
    expect(Array.from(researchDetails!.querySelectorAll("dt")).map((term) => term.textContent)).toEqual(["Labs"]);
    expect(research.queryByText("Graduate Research Assistant")).not.toBeInTheDocument();
    expect(research.queryByText("Position")).not.toBeInTheDocument();
    expect(research.queryByText("Contributions")).not.toBeInTheDocument();
    expect(research.getByText("Lead Engineer & First Author")).toHaveClass("profile-overview__entity-subtitle");
    expect(
      Array.from(researchDetails!.querySelectorAll("ul.profile-overview__research-fact-list li")).map(
        (item) => item.textContent
      )
    ).toEqual(["SEE Lab, UW Bothell School of STEM", "Miller Lab, University of Utah"]);
    expect(researchSection!.querySelector(".profile-overview__summary")).not.toBeInTheDocument();
    expect(screen.getAllByText("Current Organization Sentinel")).toHaveLength(1);

    const researchEntity = researchSection!.querySelector<HTMLElement>(".profile-overview__entity");
    expect(researchEntity).not.toBeNull();
    expect(within(researchEntity!).getByRole("heading", { level: 3, name: "Research Project Sentinel" })).toBeInTheDocument();
    const researchLogo = researchSection?.querySelector<HTMLImageElement>(
      'img[src="/images/organizations/research-sentinel.svg"]'
    );
    expect(researchLogo).toHaveAttribute("alt", "");
    expect(researchLogo).toHaveAttribute("aria-hidden", "true");
    expect(researchLogo).toHaveAttribute("width", "48");
    expect(researchLogo).toHaveAttribute("height", "48");

    const liveSiteLink = research.getByRole("link", { name: "Live site" });
    const sourceCodeLink = research.getByRole("link", { name: "Source code" });
    expect(liveSiteLink).toHaveAttribute("href", "https://example.com/research-live");
    expect(sourceCodeLink).toHaveAttribute("href", "https://github.com/example/research-source");
    expect(liveSiteLink).toHaveAttribute("target", "_blank");
    expect(sourceCodeLink).toHaveAttribute("target", "_blank");
    expect(liveSiteLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(sourceCodeLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(liveSiteLink).toHaveClass(
      "profile-overview__research-link",
      "hover-base-1",
      "hover-base-1--compact",
      "hover-base-1--inline"
    );
    expect(sourceCodeLink).toHaveClass(
      "profile-overview__research-link",
      "hover-base-1",
      "hover-base-1--compact",
      "hover-base-1--inline"
    );
    expect(liveSiteLink).not.toHaveClass("glass-link", "glass-button");
    expect(sourceCodeLink).not.toHaveClass("glass-link", "glass-button");
    expect(liveSiteLink.querySelector("svg")).not.toBeInTheDocument();
    expect(sourceCodeLink.querySelector("svg")).not.toBeInTheDocument();
    const researchResources = research.getByRole("list", { name: "Research Project Sentinel resources" });
    expect(researchResources).toHaveClass("profile-overview__research-links", "profile-overview__academic-footer");
    expect(Array.from(researchResources.querySelectorAll("li")).map((item) => item.textContent)).toEqual([
      "Live site",
      "Source code",
      "Manuscript"
    ]);
    const manuscriptButton = research.getByRole("button", { name: "Manuscript — not yet published" });
    expect(manuscriptButton).toBeDisabled();
    expect(manuscriptButton).not.toHaveAttribute("href");
    expect(manuscriptButton).toHaveAttribute("title", "Not yet published");
    expect(manuscriptButton).toHaveClass(
      "profile-overview__research-link",
      "hover-base-1",
      "hover-base-1--compact",
      "hover-base-1--inline",
      "profile-overview__research-link--pending"
    );

    const researchPageLink = research.getByRole("link", { name: "View research" });
    expect(researchPageLink).toHaveAttribute("href", "/research");
    expect(researchPageLink).toHaveClass(
      "profile-overview__panel-action",
      "hover-base-1",
      "hover-base-1--compact",
      "hover-base-1--inline"
    );
    expect(researchPageLink.parentElement).toHaveClass("profile-overview__panel-action-slot");
    expect(researchPageLink.closest("header")).toHaveClass("profile-overview__panel-header--with-action");
    expect(researchPageLink.querySelector(".glass-link__arrow")).not.toBeInTheDocument();

    expect(screen.queryByRole("navigation", { name: "Related profile pages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view full experience/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /explore research/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@example" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "in/example" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "nicolas@example.com" })).toHaveAttribute("href", "mailto:nicolas@example.com");
    expect(screen.getByRole("link", { name: "https://example.com" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits optional profile blocks and logo containers without crashing", () => {
    const content = createFooterContent();

    const { container } = render(
      <PortfolioHero
        links={content.links}
        motionEnabled={false}
        overview={{ greetingName: "Nicolas", role: { kind: "static", label: "A concise profile headline." } }}
        profile={content.profile}
      />
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelector(".profile-role__accessible")).toHaveTextContent("A concise profile headline.");
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Headline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Previous Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Research" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Education" })).not.toBeInTheDocument();
    expect(container.querySelector(".profile-overview__affiliation-mark")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View experience" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View research" })).not.toBeInTheDocument();
  });

  it("renders a quiet portrait placeholder when no portrait image is configured", () => {
    const content = createFooterContent();

    render(
      <PortfolioHero
        links={content.links}
        motionEnabled={false}
        overview={createProfileOverviewContent(content)}
        profile={content.profile}
      />
    );

    expect(screen.getByRole("img", { name: /nicolas gioanni portrait placeholder/i })).toHaveTextContent("NG");
  });

  it("renders a static portrait image when the profile provides one", () => {
    const content = createFooterContent();

    render(
      <PortfolioHero
        links={content.links}
        motionEnabled={false}
        overview={createProfileOverviewContent(content)}
        profile={{ ...content.profile, portraitImage: "/images/profile/nicolas.png" }}
      />
    );

    expect(screen.getByRole("img", { name: "Nicolas Gioanni" })).toHaveAttribute("src", "/images/profile/nicolas.png");
    expect(screen.queryByRole("img", { name: /portrait placeholder/i })).not.toBeInTheDocument();
  });

  it("renders safe rel attributes for external glass icon links", () => {
    render(<GlassIconLink label="GitHub" url="https://github.com/example" />);

    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders generated footer owner and hides missing repository link gracefully", () => {
    const { container } = render(<BlobFooter content={createFooterContent()} />);

    expect(screen.getByText(/Nicolas Gioanni\. All rights reserved except where otherwise stated\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.queryByRole("link", { name: "Source Code" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Site Terms & Accuracy" })).toHaveAttribute("href", "/terms");
    const emailLink = screen.getByRole("link", { name: "nicolas@example.com" });
    const contactLink = screen.getByRole("link", { name: "Contact Form" });
    expect(contactLink).toHaveAttribute("href", "/contact");
    expect(emailLink.closest("li")?.nextElementSibling).toBe(contactLink.closest("li"));
    expect(container.querySelector(".glass-icon-link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose color theme/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^(Light|Navy|Dark)$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/built as a static/i)).not.toBeInTheDocument();
  });

  it("renders repository link when provided by site settings", () => {
    render(<BlobFooter content={createFooterContent("https://github.com/example/portfolio")} />);

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("link", { name: "Source Code" })).toHaveAttribute("href", "https://github.com/example/portfolio");
  });
});
