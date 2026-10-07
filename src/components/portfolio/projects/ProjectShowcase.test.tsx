import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectItem } from "@/content/types";
import { ProjectCard } from "@/components/portfolio/projects/ProjectCard";
import { ProjectsNoScriptFallback } from "@/components/portfolio/projects/ProjectsNoScriptFallback";
import { getProjectActions } from "@/lib/projects/projectActions";
import { getProjectVisual, projectVisualRegistry } from "@/lib/projects/projectVisualRegistry";

const complianceProject: ProjectItem = {
  detailSummary: "Turns alcohol-label images into explainable field checks with AI extraction and deterministic verification.",
  featured: false,
  homeSkills: [],
  id: "compliance-label-assistant",
  image: "/images/projects/compliance-label-assistant-concept.webp",
  links: [
    { label: "Live demo", url: "https://compliance-label-assistant.nicolasmgioanni.dev/" },
    { label: "Source code", url: "https://github.com/nicolasgioanni/Compliance-Label-Assistant" }
  ],
  problem: "Legacy detail text should not be shown.",
  showOnHome: true,
  solution: "A hidden implementation detail.",
  stack: ["Python", "AI"],
  title: "Compliance Label Assistant"
};

describe("Project showcase", () => {
  it("uses a complete typed visual registry with the optimized intrinsic dimensions", () => {
    expect(Object.keys(projectVisualRegistry)).toEqual([
      "compliance-label-assistant",
      "notepal",
      "tergion-technologies",
      "leetnotes",
      "clair"
    ]);

    for (const [id, visual] of Object.entries(projectVisualRegistry)) {
      expect(getProjectVisual(id)).toBe(visual);
      expect(visual.concept.src).toBe(`/images/projects/${id}-concept.webp`);
      expect(visual.concept).toMatchObject({ height: 992, width: 1586 });
      expect(visual.diagram.nodes.length).toBeGreaterThanOrEqual(4);
    }
    expect(getProjectVisual("constructor")).toBeUndefined();
    expect(getProjectVisual("__proto__")).toBeUndefined();
  });

  it("keeps the concept visible initially, removes the old detail wall, and uses source-first actions", () => {
    const { container } = render(<ProjectCard item={complianceProject} variant="detail" />);
    const card = container.querySelector<HTMLElement>(".project-card--showcase");

    expect(card).toBeInTheDocument();
    expect(within(card!).getByRole("heading", { name: "Compliance Label Assistant" })).toBeInTheDocument();
    expect(within(card!).getByRole("tab", { name: "Concept" })).toHaveAttribute("aria-selected", "true");
    expect(within(card!).getByRole("img", { name: /bottle label passing/i })).toHaveAttribute("width", "1586");
    expect(within(card!).queryByText(/legacy detail text/i)).not.toBeInTheDocument();
    expect(card!.querySelector(".tag-list")).not.toBeInTheDocument();
    expect(within(card!).getAllByRole("link").map((link) => link.textContent)).toEqual(["Source code", "Live demo"]);
  });

  it("keeps each card's folder tabs local and supports roving arrow, Home, and End keyboard selection", () => {
    render(
      <>
        <ProjectCard item={complianceProject} variant="detail" />
        <ProjectCard item={{ ...complianceProject, id: "clair", title: "Clair" }} variant="detail" />
      </>
    );

    const tablists = screen.getAllByRole("tablist");
    const firstTabs = within(tablists[0]!);
    const secondTabs = within(tablists[1]!);
    const concept = firstTabs.getByRole("tab", { name: "Concept" });
    const howItWorks = firstTabs.getByRole("tab", { name: "How it works" });

    fireEvent.keyDown(concept, { key: "ArrowRight" });
    expect(howItWorks).toHaveAttribute("aria-selected", "true");
    expect(howItWorks).toHaveFocus();
    expect(screen.getByText("AI extraction")).toBeVisible();
    expect(secondTabs.getByRole("tab", { name: "Concept" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(howItWorks, { key: "Home" });
    expect(concept).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(concept, { key: "End" });
    expect(howItWorks).toHaveAttribute("aria-selected", "true");
  });

  it("selects configured source and demo destinations, omitting unavailable demos", () => {
    expect(getProjectActions(complianceProject.links).map((action) => action.label)).toEqual(["Source code", "Live demo"]);
    expect(
      getProjectActions([{ label: "Source code", url: "https://github.com/example/source-only" }]).map((action) => action.label)
    ).toEqual(["Source code"]);
  });

  it("server-renders the Concept view first and emits a native static visual without client tabs", () => {
    const enhancedMarkup = renderToStaticMarkup(<ProjectCard item={complianceProject} variant="detail" />);
    const staticMarkup = renderToStaticMarkup(<ProjectCard item={complianceProject} staticVisual variant="detail" />);

    expect(enhancedMarkup).toContain('role="tab"');
    expect(enhancedMarkup).toContain('aria-selected="true"');
    expect(enhancedMarkup).toContain(complianceProject.image!);
    expect(enhancedMarkup).toContain("Source code for Compliance Label Assistant");
    expect(staticMarkup).toContain("<details");
    expect(staticMarkup).toContain("<summary>How it works</summary>");
    expect(staticMarkup).toContain("Label image to reviewer results");
    expect(staticMarkup).not.toContain('role="tab"');
    expect(staticMarkup).not.toContain("<noscript");
  });

  it("keeps unknown projects authored without inventing a project-specific visual", () => {
    const { container } = render(
      <ProjectCard item={{ ...complianceProject, id: "unlisted-project", title: "Authored fallback" }} variant="detail" />
    );

    expect(container.querySelector(".project-visual-tabs")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Authored fallback" })).toBeInTheDocument();
    expect(container.querySelector(".project-card__image")).toBeInTheDocument();
  });

  it("server-renders the composed no-JavaScript Projects fallback with native disclosures and source-first links", () => {
    const markup = renderToStaticMarkup(<ProjectsNoScriptFallback items={[complianceProject]} />);

    expect(markup).toMatch(/<h1[^>]*>Projects<\/h1>/);
    expect(markup).toContain("Compliance Label Assistant");
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary>How it works</summary>");
    expect(markup.indexOf("Source code for Compliance Label Assistant")).toBeLessThan(
      markup.indexOf("Live demo for Compliance Label Assistant")
    );
    expect(markup).not.toContain('role="tab"');
    expect(markup).not.toContain("<noscript");
    expect(markup).not.toContain('rel="preload"');
  });
});
