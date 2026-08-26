import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResearchItem } from "@/content/types";
import { ResearchShowcase } from "@/components/portfolio/ResearchShowcase";
import { getResearchModeContent } from "@/lib/content/researchNarratives";

const researchItems: ResearchItem[] = [
  {
    id: "cytocv-miller-lab",
    title: "CytoCV: Reproducible Yeast Microscopy Analysis",
    homeTitle: "CytoCV",
    role: "Graduate Research Assistant",
    organization: "UW Bothell School of STEM",
    location: "Bothell, Washington, United States",
    startDate: "2024-08",
    endDate: "2026-08",
    impact: "Released as citable open-source software.",
    bullets: [],
    skills: [],
    links: [
      { label: "Live site", url: "https://cytocv.uwb.edu" },
      { label: "Source code", url: "https://github.com/BrentLagesse/CytoCV" },
      { label: "Software DOI", url: "https://doi.org/10.5281/zenodo.21988218" }
    ],
    pendingLinks: ["Manuscript"],
    featured: true,
    showOnHome: true
  },
  {
    id: "adversarial-machine-learning",
    title: "Adversarial Machine Learning",
    homeTitle: "Adversarial Machine Learning",
    role: "Undergraduate Researcher",
    organization: "UW Bothell School of STEM",
    bullets: [],
    skills: [],
    links: [
      { label: "Source code", url: "https://github.com/nicolasgioanni/Independent-Study" },
      { label: "Manuscript", url: "https://example.com/reference.pdf" }
    ],
    featured: false,
    showOnHome: true
  },
  {
    id: "yeast-dna-target-selection",
    title: "Guide Donor Scheduler: Yeast CRISPR Sequence Design",
    homeTitle: "Guide Donor Scheduler",
    role: "Research Assistant",
    organization: "UW Bothell School of STEM",
    bullets: [],
    skills: [],
    links: [{ label: "Source code", url: "https://github.com/BrentLagesse/GuideDonorScheduler" }],
    featured: false,
    showOnHome: true
  }
];

describe("ResearchShowcase", () => {
  it("renders a concise research introduction and alternating visual project rows", () => {
    const { container } = render(<ResearchShowcase items={researchItems} motionEnabled={false} />);
    const intro = screen
      .getByRole("heading", { level: 1, name: "Applied AI Research" })
      .closest<HTMLElement>(".page-intro__surface");
    const projects = Array.from(container.querySelectorAll<HTMLElement>(".research-project"));

    expect(intro).not.toBeNull();
    expect(within(intro!).getByText(/My research centers on CytoCV and adversarial machine learning/)).toBeInTheDocument();
    expect(intro!.textContent).not.toContain("—");
    expect(screen.getByRole("group", { name: "Research detail level" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");
    expect(projects).toHaveLength(3);
    expect(projects.map((project) => project.dataset.visualSide)).toEqual(["left", "right", "left"]);
    expect(screen.getAllByRole("img").map((visual) => visual.getAttribute("aria-label"))).toEqual([
      "Multichannel yeast segmentation diagram",
      "Eight-prototype adversarial attack and defense matrix",
      "Guide and donor sequence design diagram"
    ]);
  });

  it("keeps technical skills visible for research items without authored bullets", () => {
    const item: ResearchItem = {
      ...researchItems[0]!,
      id: "future-research-system",
      title: "Future Research System",
      homeTitle: undefined,
      bullets: [],
      skills: ["Python", "Scientific computing"]
    };

    expect(getResearchModeContent(item, "technical").sections).toEqual([
      expect.objectContaining({
        lead: "Implemented the project with the technologies listed below.",
        tools: ["Python", "Scientific computing"]
      })
    ]);
  });

  it("exposes verified resources and keeps the CytoCV manuscript placeholder inactive", () => {
    render(<ResearchShowcase items={researchItems} motionEnabled={false} />);
    const cytocvProject = screen.getByRole("heading", { level: 2, name: "CytoCV" }).closest("article");

    expect(cytocvProject).not.toBeNull();
    expect(within(cytocvProject!).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Live site",
      "Source code",
      "Software DOI"
    ]);
    expect(within(cytocvProject!).getByRole("link", { name: "Source code for CytoCV" })).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
    expect(
      within(cytocvProject!)
        .getByText("Manuscript forthcoming")
        .closest(".research-project__resource--pending")
    ).toHaveAttribute("aria-disabled", "true");
    expect(within(cytocvProject!).queryByRole("link", { name: /Manuscript/i })).not.toBeInTheDocument();

    const amlProject = screen.getByRole("heading", { level: 2, name: "Adversarial Machine Learning" }).closest("article");
    expect(within(amlProject!).getByRole("link", { name: "Reference manuscript for Adversarial Machine Learning" })).toBeInTheDocument();
  });

  it("switches every project to technical copy and keeps one disclosure open per project", () => {
    render(<ResearchShowcase items={researchItems} motionEnabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Technical" }));

    expect(screen.getByRole("button", { name: "Technical" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Showing technical details.")).toHaveClass("visually-hidden");
    expect(screen.getByText(/Architected a Django system with DIC-guided Mask R-CNN inference/)).toBeInTheDocument();

    const ingestion = screen.getByRole("button", { name: /Microscopy ingestion/i });
    const segmentation = screen.getByRole("button", { name: /Vision pipeline/i });

    fireEvent.click(ingestion);
    expect(ingestion).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(segmentation);
    expect(ingestion).toHaveAttribute("aria-expanded", "false");
    expect(segmentation).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list", { name: "Vision pipeline tools" })).toBeInTheDocument();

    fireEvent.keyDown(segmentation, { key: "Escape" });
    expect(segmentation).toHaveAttribute("aria-expanded", "false");
  });
});
