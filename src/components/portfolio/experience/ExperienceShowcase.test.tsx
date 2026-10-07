import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ExperienceItem } from "@/content/types";
import { ExperienceShowcase } from "@/components/portfolio/experience/ExperienceShowcase";

const cytocvExperience: ExperienceItem = {
  id: "research-assistant-software-engineering",
  title: "Research Assistant (Software Engineering)",
  organization: "UW Bothell School of STEM",
  organizationLogo: "/images/organizations/uwb_stem_logo.png",
  organizationLogoAlt: "UW Bothell School of STEM logo",
  type: "research",
  location: "Bothell, Washington, United States",
  startDate: "2024-08",
  endDate: "2026-08",
  homeSummary: "Built and deployed full-stack computer-vision tools for scientific microscopy analysis.",
  detailSummary: "Architected a Django application with JSON endpoints and a JavaScript frontend.",
  bullets: ["Built DIC-guided Mask R-CNN analysis workflows"],
  skills: ["Python", "Django"],
  links: [],
  featured: true,
  showOnHome: true
};

const treasuryExperience: ExperienceItem = {
  id: "us-treasury-ai-engineer",
  title: "AI Engineer",
  organization: "U.S. Department of the Treasury",
  organizationLogo: "/images/organizations/us_treasury_logo.webp",
  organizationLogoAlt: "U.S. Department of the Treasury logo",
  location: "Washington, District of Columbia, United States",
  startDate: "2026-08",
  endDate: "2026-10",
  bullets: [],
  skills: [],
  links: [{ label: "Tech.Treasury.Gov", url: "https://tech.treasury.gov" }],
  featured: true,
  showOnHome: true
};

const cdaoExperience: ExperienceItem = {
  id: "cdao-some-kinda-engineer",
  title: "Member of Technical Staff",
  organization: "DoW Chief Digital & Artificial Intelligence Office (CDAO)",
  organizationLogo: "/images/organizations/cdao_logo.webp",
  organizationLogoAlt: "DoW Chief Digital & Artificial Intelligence Office (CDAO) emblem",
  location: "Washington, District of Columbia, United States",
  startDate: "2026-10",
  endDate: "Present",
  bullets: [],
  skills: [],
  links: [],
  featured: true,
  showOnHome: true
};

const experienceSummary =
  "My experience spans AI engineering, university research, and teaching core computer science courses.";

describe("ExperienceShowcase", () => {
  it("renders logo-led role cards in the plain-language mode by default", () => {
    const { container } = render(
      <ExperienceShowcase items={[cytocvExperience]} motionEnabled={false} summary={experienceSummary} />
    );

    const pageHeading = screen.getByRole("heading", { level: 1, name: "Experience" });
    const introSurface = pageHeading.closest<HTMLElement>(".page-intro__surface");
    const modeGroup = screen.getByRole("group", { name: /Experience detail level/i });
    const modeLabel = introSurface?.querySelector(".detail-mode-control__label");

    expect(container.querySelectorAll(".page-intro__surface")).toHaveLength(1);
    expect(introSurface).toHaveClass("page-intro__surface--with-accessory");
    expect(introSurface).toContainElement(modeGroup);
    expect(within(introSurface!).getByText(experienceSummary)).toBeInTheDocument();
    expect(modeLabel).toHaveTextContent("Detail");
    expect(within(modeGroup).getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");
    expect(within(modeGroup).getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Showing overview details.")).toHaveClass("visually-hidden");
    expect(screen.getByText("Showing overview details.")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { level: 2, name: "Research Assistant (Software Engineering)" })).toBeInTheDocument();
    expect(screen.getByText("UW Bothell School of STEM")).toBeInTheDocument();
    expect(screen.getByText("Aug 2024 – Aug 2026")).toBeInTheDocument();
    const metadataLines = Array.from(container.querySelectorAll(".experience-card__metadata-line"));
    expect(metadataLines.map((line) => line.textContent)).toEqual([
      "Aug 2024 – Aug 2026 · 2 yrs 1 mo",
      "Bothell, Washington, United States"
    ]);
    expect(screen.getByText("Bothell, Washington, United States")).toBeInTheDocument();
    expect(screen.getByText(/Built and deployed CytoCV/)).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(container.querySelector(".experience-card__logo")).toHaveAttribute(
      "src",
      "/images/organizations/uwb_stem_logo.png"
    );
    expect(container.querySelector(".experience-card__logo")).toHaveAttribute("alt", "");
    expect(container.querySelector(".experience-timeline")).not.toBeInTheDocument();
  });

  it("renders valid date-only and location-only metadata without inventing a second row", () => {
    const dateOnlyExperience: ExperienceItem = {
      ...treasuryExperience,
      id: "date-only-experience",
      title: "Date Only Engineer",
      location: undefined
    };
    const locationOnlyExperience: ExperienceItem = {
      ...treasuryExperience,
      id: "location-only-experience",
      title: "Location Only Engineer",
      startDate: undefined,
      endDate: undefined,
      location: "Remote"
    };

    render(
      <ExperienceShowcase
        items={[dateOnlyExperience, locationOnlyExperience]}
        motionEnabled={false}
        summary={experienceSummary}
      />
    );

    const dateOnlyCard = screen.getByRole("heading", { level: 2, name: "Date Only Engineer" }).closest("article");
    const locationOnlyCard = screen.getByRole("heading", { level: 2, name: "Location Only Engineer" }).closest("article");

    expect(dateOnlyCard).not.toBeNull();
    expect(locationOnlyCard).not.toBeNull();
    expect(Array.from(dateOnlyCard!.querySelectorAll(".experience-card__metadata-line")).map((line) => line.textContent)).toEqual([
      "Aug 2026 – Oct 2026 · 3 mos"
    ]);
    expect(Array.from(locationOnlyCard!.querySelectorAll(".experience-card__metadata-line")).map((line) => line.textContent)).toEqual([
      "Remote"
    ]);
  });

  it("switches the full page to technical copy and scopes tools to expandable chapters", () => {
    render(<ExperienceShowcase items={[cytocvExperience]} motionEnabled={false} summary={experienceSummary} />);

    fireEvent.click(screen.getByRole("button", { name: "Technical" }));

    expect(screen.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Showing technical details.")).toHaveClass("visually-hidden");
    expect(screen.queryByText("Showing overview details.")).not.toBeInTheDocument();
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

  it("keeps one selected chapter across roles and closes it with Escape or a noninteractive card click", async () => {
    const secondRole = {
      ...cytocvExperience,
      id: "second-research-role",
      organization: "Second research organization",
      title: "Second Research Assistant"
    };
    render(<ExperienceShowcase items={[cytocvExperience, secondRole]} motionEnabled={false} summary={experienceSummary} />);

    const cards = screen.getAllByRole("article");
    const workflowButton = within(cards[0]!).getByRole("button", { name: /Scientific Workflow Automation/i });
    const analysisButton = cards[1]!.querySelector<HTMLButtonElement>(".detail-section__trigger");

    expect(analysisButton).not.toBeNull();

    fireEvent.click(workflowButton);
    expect(workflowButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(analysisButton!);
    expect(workflowButton).toHaveAttribute("aria-expanded", "false");
    expect(analysisButton!).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(analysisButton!, { key: "Escape" });
    await waitFor(() => expect(analysisButton!).toHaveAttribute("aria-expanded", "false"));

    fireEvent.click(analysisButton!);
    expect(analysisButton!).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(cards[1]!).getByText("Second research organization"));
    expect(analysisButton!).toHaveAttribute("aria-expanded", "false");
  });

  it("closes through document Escape and restores focus without consuming a handled Escape", async () => {
    render(<ExperienceShowcase items={[cytocvExperience]} motionEnabled={false} summary={experienceSummary} />);

    const trigger = screen.getByRole("button", { name: /Scientific Workflow Automation/i });
    fireEvent.click(trigger);
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
    const scrollport = panel?.querySelector<HTMLElement>(".detail-section__panel-scroll");
    expect(scrollport).not.toBeNull();
    scrollport!.focus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    const handledEscape = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" });
    handledEscape.preventDefault();
    document.dispatchEvent(handledEscape);
    await Promise.resolve();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("renders link-only roles without an unavailable-details placeholder", () => {
    render(<ExperienceShowcase items={[treasuryExperience]} motionEnabled={false} summary={experienceSummary} />);

    const roleCard = screen.getByRole("heading", { level: 2, name: "AI Engineer" }).closest("article");

    expect(roleCard).not.toBeNull();
    expect(within(roleCard!).getByText("U.S. Department of the Treasury")).toBeInTheDocument();
    expect(within(roleCard!).getByText("Washington, District of Columbia, United States")).toBeInTheDocument();
    expect(within(roleCard!).getByText("Tech.Treasury.Gov")).toBeInTheDocument();
    const treasuryResource = within(roleCard!).getByRole("link", { name: "Tech.Treasury.Gov" });
    expect(treasuryResource).toHaveAttribute(
      "href",
      "https://tech.treasury.gov"
    );
    expect(treasuryResource).toHaveAttribute("target", "_blank");
    expect(treasuryResource).toHaveAttribute("rel", "noopener noreferrer");
    expect(treasuryResource).toHaveClass("experience-card__resource");
    expect(within(roleCard!).queryByText("Current")).not.toBeInTheDocument();
    expect(within(roleCard!).queryByText("Details not yet available.")).not.toBeInTheDocument();
    expect(within(roleCard!).queryByRole("button")).not.toBeInTheDocument();
    expect(Array.from(roleCard!.querySelectorAll(".experience-card__metadata-line")).map((line) => line.textContent)).toEqual([
      "Aug 2026 – Oct 2026 · 3 mos",
      "Washington, District of Columbia, United States"
    ]);
  });

  it("shows the unavailable-details placeholder for roles without authored details or links", () => {
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });

    try {
      const { container } = render(
        <ExperienceShowcase items={[cdaoExperience]} motionEnabled={false} summary={experienceSummary} />
      );

      expect(screen.getByText("Details not yet available.")).toBeInTheDocument();
      expect(screen.getByText("Current")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Member of Technical Staff" })).toBeInTheDocument();
      expect(container.querySelector(".experience-card__logo")).toHaveAttribute("src", "/images/organizations/cdao_logo.webp");
      expect(screen.getByText("Oct 2026 – Present")).toBeInTheDocument();
      expect(screen.getByText("Washington, District of Columbia, United States")).toBeInTheDocument();
      expect(
        Array.from(container.querySelectorAll(".experience-card__metadata-line")).map((line) => line.textContent)
      ).toEqual(["Oct 2026 – Present · 1 mo", "Washington, District of Columbia, United States"]);

      vi.setSystemTime(new Date("2026-11-01T12:00:00"));
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      fireEvent(document, new Event("visibilitychange"));
      expect(container.querySelector(".experience-card__metadata-line")?.textContent).toBe("Oct 2026 – Present · 1 mo");

      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      fireEvent(document, new Event("visibilitychange"));
      expect(container.querySelector(".experience-card__metadata-line")?.textContent).toBe("Oct 2026 – Present · 2 mos");
    } finally {
      if (visibilityDescriptor) {
        Object.defineProperty(document, "visibilityState", visibilityDescriptor);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
      vi.useRealTimers();
    }
  });

  it("keeps current-role static HTML readable without a clock-dependent duration", () => {
    const markup = renderToStaticMarkup(
      <ExperienceShowcase items={[cdaoExperience]} motionEnabled={false} summary={experienceSummary} />
    );

    expect(markup).toContain("Oct 2026 – Present");
    expect(markup).not.toContain("1 mo");
  });

  it("keeps the combined page heading and summary when there are no roles", () => {
    const { container } = render(<ExperienceShowcase items={[]} motionEnabled={false} summary={experienceSummary} />);

    expect(screen.getByRole("heading", { level: 1, name: "Experience" })).toBeInTheDocument();
    expect(screen.getByText(experienceSummary)).toBeInTheDocument();
    expect(container.querySelectorAll(".page-intro__surface")).toHaveLength(1);
    expect(screen.queryByRole("group", { name: /Experience detail level/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Experience entries will appear here when content is available.");
  });
});
