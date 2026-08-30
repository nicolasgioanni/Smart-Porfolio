import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ExperienceItem } from "@/content/types";
import { ExperienceShowcase } from "@/components/portfolio/ExperienceShowcase";

const cytocvExperience: ExperienceItem = {
  id: "research-assistant-software-engineering",
  title: "Research Assistant (Software Engineering)",
  organization: "UW Bothell School of STEM",
  organizationLogo: "/images/organizations/uwb_stem_logo.png",
  organizationLogoAlt: "UW Bothell School of STEM logo",
  type: "research",
  location: "Bothell, WA",
  startDate: "2024-08",
  endDate: "2026-08",
  homeSummary: "Built and deployed full-stack computer-vision tools for scientific microscopy analysis.",
  detailSummary: "Architected a Django REST API and JavaScript frontend.",
  bullets: ["Reduced manual microscopy analysis by 97%"],
  skills: ["Python", "Django"],
  featured: true,
  showOnHome: true
};

const treasuryExperience: ExperienceItem = {
  id: "us-treasury-ai-engineer",
  title: "AI Engineer",
  organization: "U.S. Department of the Treasury",
  organizationLogo: "/images/organizations/us_treasury_logo.webp",
  organizationLogoAlt: "U.S. Department of the Treasury logo",
  startDate: "2026-08",
  endDate: "Present",
  bullets: [],
  skills: [],
  featured: true,
  showOnHome: true
};

describe("ExperienceShowcase", () => {
  it("renders logo-led role cards in the plain-language mode by default", () => {
    const { container } = render(<ExperienceShowcase items={[cytocvExperience]} motionEnabled={false} />);

    expect(screen.getByRole("button", { name: "For everyone" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { level: 2, name: "Research Assistant (Software Engineering)" })).toBeInTheDocument();
    expect(screen.getByText("UW Bothell School of STEM")).toBeInTheDocument();
    expect(screen.getByText("Aug 2024 – Aug 2026")).toBeInTheDocument();
    expect(screen.getByText("Bothell, WA")).toBeInTheDocument();
    expect(screen.getByText(/Built and deployed CytoCV/)).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(container.querySelector(".experience-card__logo")).toHaveAttribute(
      "src",
      "/images/organizations/uwb_stem_logo.png"
    );
    expect(container.querySelector(".experience-card__logo")).toHaveAttribute("alt", "");
    expect(container.querySelector(".experience-timeline")).not.toBeInTheDocument();
  });

  it("switches the full page to technical copy and scopes tools to expandable chapters", () => {
    render(<ExperienceShowcase items={[cytocvExperience]} motionEnabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Technical" }));

    expect(screen.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Architected a Django and JavaScript application/)).toBeInTheDocument();
    const architectureButton = screen.getByRole("button", { name: /Application architecture/i });
    const architecturePanel = document.getElementById(architectureButton.getAttribute("aria-controls")!);

    expect(architectureButton).toHaveAttribute("aria-expanded", "false");
    expect(architecturePanel).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(architectureButton);

    expect(architectureButton).toHaveAttribute("aria-expanded", "true");
    expect(architecturePanel).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("region", { name: /Application architecture/i })).toBe(architecturePanel);
    expect(within(architecturePanel!).getByRole("list", { name: "Application architecture tools" })).toBeInTheDocument();
    expect(within(architecturePanel!).getByText("Python")).toBeInTheDocument();
    expect(within(architecturePanel!).getByText("PostgreSQL")).toBeInTheDocument();
  });

  it("keeps one chapter open per role and closes the active chapter with Escape", () => {
    render(<ExperienceShowcase items={[cytocvExperience]} motionEnabled={false} />);

    const workflowButton = screen.getByRole("button", { name: /Scientific workflow/i });
    const analysisButton = screen.getByRole("button", { name: /Image analysis/i });

    fireEvent.click(workflowButton);
    expect(workflowButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(analysisButton);
    expect(workflowButton).toHaveAttribute("aria-expanded", "false");
    expect(analysisButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(analysisButton, { key: "Escape" });
    expect(analysisButton).toHaveAttribute("aria-expanded", "false");
  });

  it("shows verified identity only when a role has no published details", () => {
    render(<ExperienceShowcase items={[treasuryExperience]} motionEnabled={false} />);

    const roleCard = screen.getByRole("heading", { level: 2, name: "AI Engineer" }).closest("article");

    expect(roleCard).not.toBeNull();
    expect(within(roleCard!).getByText("U.S. Department of the Treasury")).toBeInTheDocument();
    expect(within(roleCard!).getByText("Aug 2026 – Present")).toBeInTheDocument();
    expect(within(roleCard!).getByText("Current")).toBeInTheDocument();
    expect(within(roleCard!).getByText("Details not yet available.")).toBeInTheDocument();
    expect(within(roleCard!).queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the existing empty state when there are no roles", () => {
    render(<ExperienceShowcase items={[]} motionEnabled={false} />);

    expect(screen.getByRole("status")).toHaveTextContent("Experience entries will appear here when content is available.");
  });
});
