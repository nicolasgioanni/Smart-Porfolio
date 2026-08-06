import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ExperienceItem, GeneratedPortfolioContent, HomePortfolioContent, ProfileOverviewContent, RecommendationItem } from "@/content/types";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { BlobFooter } from "@/components/layout/BlobFooter";
import { PageIntro } from "@/components/layout/PageIntro";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { FeaturedGrid } from "@/components/portfolio/FeaturedGrid";
import { HomeEducationSummary } from "@/components/portfolio/HomeEducationSummary";
import { HomeFeaturedExperience } from "@/components/portfolio/HomeFeaturedExperience";
import { HomeOverview } from "@/components/portfolio/HomeOverview";
import { HomeRecommendations } from "@/components/portfolio/HomeRecommendations";
import { HomeSkillsSnapshot } from "@/components/portfolio/HomeSkillsSnapshot";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { RecommendationsList } from "@/components/portfolio/RecommendationsList";
import type { HomeSkillStory } from "@/components/portfolio/homeSkillStories";
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

function createHomeContent(recommendations: RecommendationItem[] = []): HomePortfolioContent {
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
    skillGroups: [],
    resume: [],
    siteSettings: content.siteSettings
  };
}

describe("portfolio UI helpers", () => {
  it("renders reusable page and section headers", () => {
    render(
      <>
        <SectionHeader actionHref="/projects" actionLabel="View projects" description="Selected work." eyebrow="Projects" title="Engineering projects" />
        <PageIntro description="Resume details." eyebrow="Resume" motionEnabled={false} title="Resume" />
      </>
    );

    expect(screen.getByRole("heading", { name: "Engineering projects" })).toBeInTheDocument();
    expect(screen.getByText("Selected work.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view projects/i })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("heading", { level: 1, name: "Resume" })).toBeInTheDocument();
  });

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
    expect(screen.getByText("Jan 2025 \u2013 Present")).toBeInTheDocument();
    expect(screen.getByText("Sep 2024 \u2013 Dec 2024")).toBeInTheDocument();
    expect(screen.getAllByText("Bothell, WA")).toHaveLength(2);
    expect(screen.queryByText("research", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Featured", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Summary that should stay hidden.")).not.toBeInTheDocument();
    expect(screen.queryByText("Bullet that should stay hidden.")).not.toBeInTheDocument();
    expect(screen.queryByText("Python", { exact: true })).not.toBeInTheDocument();
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

  it("renders Home major sections without repetitive card eyebrows", () => {
    const { container } = render(<HomeOverview content={createHomeContent()} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Skills snapshot" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Experience" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Featured research" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Featured projects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Education summary" })).toBeInTheDocument();
    expect(container.querySelector(".home-overview-grid .eyebrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected roles showing engineering, research, teaching, and leadership context.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View all experience" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Resume and contact" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Professional recommendations" })).not.toBeInTheDocument();
  });

  it("renders each Home section in the requested order even when recommendations exist", () => {
    const { container } = render(<HomeOverview content={createHomeContent([recommendation])} />);

    expect(Array.from(container.querySelectorAll(".home-overview-grid h2")).map((heading) => heading.textContent)).toEqual([
      "Skills snapshot",
      "Experience",
      "Education summary",
      "Featured research",
      "Featured projects"
    ]);
  });

  it("lets visitors select a capability and inspect where it was demonstrated", () => {
    const stories: HomeSkillStory[] = [
      {
        id: "applied-ai",
        label: "Applied AI",
        summary: "Built measured AI workflows.",
        tools: ["Python", "TensorFlow/Keras"],
        evidence: [
          {
            id: "research-cytocv",
            kind: "Research",
            title: "CytoCV",
            context: "Example Lab",
            proof: "Built an image analysis pipeline.",
            outcome: "Reduced processing time by 73%.",
            tools: ["Python"],
            href: "/research"
          }
        ]
      },
      {
        id: "automation",
        label: "Automation",
        summary: "Replaced repetitive work with reliable pipelines.",
        tools: ["Python", "Bash"],
        evidence: [
          {
            id: "project-clair",
            kind: "Project",
            title: "Clair",
            proof: "Automated local file organization.",
            outcome: "Reduced manual sorting time by 80%.",
            tools: ["Python", "Bash"],
            href: "/projects"
          }
        ]
      }
    ];

    render(<HomeSkillsSnapshot skillGroups={[]} stories={stories} toolkit={["Python", "TypeScript"]} />);

    expect(screen.getByRole("button", { name: /applied ai/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "CytoCV" })).toBeInTheDocument();
    expect(screen.getByText("Reduced processing time by 73%.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /automation/i }));

    expect(screen.getByRole("button", { name: /automation/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Clair" })).toBeInTheDocument();
    expect(screen.getByText("Reduced manual sorting time by 80%.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "CytoCV" })).not.toBeInTheDocument();
  });

  it("renders portfolio-first hero copy without implementation labels", () => {
    const content = createFooterContent();
    render(
      <PortfolioHero
        links={content.links}
        motionEnabled={false}
        overview={createProfileOverviewContent(content)}
        profile={content.profile}
      />
    );

    expect(screen.getByRole("heading", { name: "Nicolas Gioanni" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "About",
      "Current Work",
      "Education"
    ]);
    expect(screen.queryByRole("heading", { name: "Headline" })).not.toBeInTheDocument();
    expect(screen.getByText("Software engineer")).toHaveClass("profile-overview__headline");
    expect(screen.getAllByText("City State").length).toBeGreaterThan(0);
    expect(screen.getByText("Pacific Time (UTC-07:00)")).toBeInTheDocument();
    expect(screen.getByText("Research Assistant")).toBeInTheDocument();
    expect(screen.getByText("Example Lab")).toBeInTheDocument();
    expect(screen.getByText("Profile University")).toBeInTheDocument();
    expect(screen.getByText("BS \u2014 Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Graduated Jun 2025")).toBeInTheDocument();
    expect(screen.queryByText(/currently/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current focus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/smart portfolio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/spreadsheet driven/i)).not.toBeInTheDocument();
  });

  it("renders the recruiter-focused profile hierarchy from prop-supplied content", () => {
    const content = createFooterContent();
    const profile = {
      ...content.profile,
      portraitImage: "/images/profile/nicolas.png"
    };
    const overview: ProfileOverviewContent = {
      headline: "Profile headline supplied through the overview prop.",
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
        degree: "Degree Sentinel",
        field: "Field Sentinel",
        concentration: "Concentration Sentinel",
        location: "Education Location Sentinel",
        startDate: "2020-09",
        endDate: "2025-06",
        graduationLabel: "Graduated Jun 2025",
        logo: { src: "/images/organizations/education-sentinel.svg", alt: "Education Institution Sentinel mark" }
      },
      research: {
        id: "research-sentinel",
        title: "Research Project Sentinel",
        summary: "Research summary supplied through the overview prop.",
        links: [
          { label: "Live site", url: "https://example.com/research-live" },
          { label: "Source code", url: "https://github.com/example/research-source" }
        ]
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
    expect(Array.from(details!.querySelectorAll(".profile-overview__headline, h2")).map((element) => element.textContent)).toEqual([
      "Profile headline supplied through the overview prop.",
      "About",
      "Current Work",
      "Education",
      "Selected Research"
    ]);
    expect(screen.queryByRole("heading", { name: "Headline" })).not.toBeInTheDocument();
    expect(screen.getByText("Profile headline supplied through the overview prop.")).toHaveClass("profile-overview__headline");
    expect(screen.queryByRole("heading", { name: "Previous Work" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Nicolas Gioanni" })).toHaveAttribute("src", "/images/profile/nicolas.png");
    expect(screen.getByText("City State")).toBeInTheDocument();
    expect(screen.getByText("About copy supplied through the overview prop.")).toBeInTheDocument();
    expect(screen.getByText("Pacific Time (UTC-07:00)")).toBeInTheDocument();

    const currentWorkSection = screen.getByRole("heading", { level: 2, name: "Current Work" }).closest("section");
    const educationSection = screen.getByRole("heading", { level: 2, name: "Education" }).closest("section");
    const researchSection = screen.getByRole("heading", { level: 2, name: "Selected Research" }).closest("section");
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

    const currentLogo = currentWorkSection?.querySelector<HTMLImageElement>('img[src="/images/organizations/current-sentinel.svg"]');
    expect(currentLogo).toHaveAttribute("alt", "");
    expect(currentLogo).toHaveAttribute("width", "48");
    expect(currentLogo).toHaveAttribute("height", "48");

    const education = within(educationSection!);
    expect(education.getByRole("heading", { level: 3, name: "Education Institution Sentinel" })).toBeInTheDocument();
    expect(education.getByText("Degree Sentinel \u2014 Field Sentinel")).toBeInTheDocument();
    expect(education.getByText(/Concentration Sentinel/)).toHaveTextContent(
      "Concentration: Concentration Sentinel"
    );
    expect(education.getByText("Graduated Jun 2025")).toBeInTheDocument();
    expect(education.queryByText("Education Location Sentinel")).not.toBeInTheDocument();
    expect(education.queryByText("Sep 2020 \u2013 Jun 2025")).not.toBeInTheDocument();

    const educationLogo = educationSection?.querySelector<HTMLImageElement>('img[src="/images/organizations/education-sentinel.svg"]');
    expect(educationLogo).toHaveAttribute("alt", "");
    expect(educationLogo).toHaveAttribute("width", "48");
    expect(educationLogo).toHaveAttribute("height", "48");

    const research = within(researchSection!);
    expect(research.getAllByRole("heading", { level: 3, name: "Research Project Sentinel" })).toHaveLength(1);
    expect(research.getByText("Research summary supplied through the overview prop.")).toBeInTheDocument();
    expect(screen.getAllByText("Current Organization Sentinel")).toHaveLength(1);

    const liveSiteLink = research.getByRole("link", { name: "Live site" });
    const sourceCodeLink = research.getByRole("link", { name: "Source code" });
    expect(liveSiteLink).toHaveAttribute("href", "https://example.com/research-live");
    expect(sourceCodeLink).toHaveAttribute("href", "https://github.com/example/research-source");
    expect(liveSiteLink).toHaveAttribute("target", "_blank");
    expect(sourceCodeLink).toHaveAttribute("target", "_blank");
    expect(liveSiteLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(sourceCodeLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(liveSiteLink).toHaveClass("hover-base-1", "hover-base-1--compact");
    expect(sourceCodeLink).toHaveClass("hover-base-1", "hover-base-1--compact");
    expect(research.queryByText("Manuscript")).not.toBeInTheDocument();
    expect(research.queryByRole("button")).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: /view full experience/i })).toHaveAttribute("href", "/experience");
    expect(screen.getByRole("link", { name: /explore research/i })).toHaveAttribute("href", "/research");
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
        overview={{ headline: "A concise profile headline." }}
        profile={content.profile}
      />
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("A concise profile headline.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Headline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Previous Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Selected Research" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Education" })).not.toBeInTheDocument();
    expect(container.querySelector(".profile-overview__affiliation-mark")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view full experience/i })).toHaveAttribute("href", "/experience");
    expect(screen.getByRole("link", { name: /explore research/i })).toHaveAttribute("href", "/research");
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
    render(<BlobFooter content={createFooterContent()} />);

    expect(screen.getByText(/Nicolas Gioanni/)).toBeInTheDocument();
    expect(screen.getAllByText(/All rights reserved/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /source available on github/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose color theme/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^(Light|Navy|Dark)$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/built as a static/i)).not.toBeInTheDocument();
  });

  it("renders repository link when provided by site settings", () => {
    render(<BlobFooter content={createFooterContent("https://github.com/example/portfolio")} />);

    expect(screen.getByRole("link", { name: /source available on github/i })).toHaveAttribute("href", "https://github.com/example/portfolio");
  });
});
