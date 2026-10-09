import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectItem } from "@/content/types";
import { ProjectCard } from "@/features/projects/components/ProjectCard";
import { ProjectsNoScriptFallback } from "@/features/projects/components/ProjectsNoScriptFallback";
import { getProjectActions, getProjectDiagramAction, getProjectPreviewAction } from "@/features/projects/selectors/projectActions";
import { getProjectVisual, projectVisualRegistry } from "@/features/projects/selectors/projectVisualRegistry";

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
  showOnHome: true,
  stack: ["Python", "AI"],
  title: "Compliance Label Assistant"
};

describe("Project showcase", () => {
  it("uses the typed screenshot and LeetNotes preview registry without fabricating unknown visuals", () => {
    expect(Object.keys(projectVisualRegistry)).toEqual(["compliance-label-assistant", "notepal", "tergion-technologies", "leetnotes", "clair"]);
    expect(getProjectVisual("leetnotes")?.preview).toMatchObject({ kind: "leetnotes", height: 561, width: 896 });
    expect(getProjectVisual("compliance-label-assistant")?.preview).toMatchObject({
      height: 800,
      mobile: { height: 360, src: "/images/projects/compliance-label-assistant-mobile.webp", width: 480 },
      width: 1280
    });
    expect(getProjectVisual("clair")?.badge).toEqual({ label: "Installable", tone: "installable" });
    expect(getProjectVisual("constructor")).toBeUndefined();
    expect(getProjectVisual("__proto__")).toBeUndefined();
  });

  it("selects shuffled releases before generic GitHub source matching and chooses preview destinations by priority", () => {
    const links = [
      { label: "Download", url: "https://github.com/example/project/releases/latest" },
      { label: "Source code", url: "https://github.com/example/project" },
      { label: "Live demo", url: "https://project.example" }
    ];
    expect(getProjectActions(links).map((action) => action.label)).toEqual(["Source code", "Live demo", "Download"]);
    expect(getProjectPreviewAction(links)?.label).toBe("Live demo");
    expect(getProjectPreviewAction(links.slice(0, 2))?.label).toBe("Download");
    expect(getProjectDiagramAction(links)?.label).toBe("Source code");
    expect(getProjectActions([{ label: "Release", url: "https://github.com/example/project/releases/latest" }]).map((action) => action.label)).toEqual(["Download"]);
    expect(getProjectActions([{ label: "Source code", url: "https://github.com/example/release-tools" }]).map((action) => action.label)).toEqual(["Source code"]);
    expect(getProjectPreviewAction([])).toBeUndefined();
  });

  it("keeps card selection independent, applies scoped keyboard navigation, and removes inactive panel focusability", () => {
    render(<><ProjectCard item={complianceProject} variant="detail" /><ProjectCard item={{ ...complianceProject, id: "clair", title: "Clair" }} variant="detail" /></>);
    const [first, second] = screen.getAllByLabelText(/project preview for/i);
    const firstToggle = within(first!).getByRole("button", { name: /how compliance label assistant works/i });
    const secondToggle = within(second!).getByRole("button", { name: /how clair works/i });
    fireEvent.keyDown(firstToggle, { key: "ArrowRight" });
    expect(firstToggle.querySelector('[data-view="preview"]')).toHaveTextContent("Preview");
    expect(secondToggle.querySelector('[data-view="workflow"]')).toHaveTextContent("How it works");
    expect(first!.querySelector('[data-view="workflow"]')).toBeInTheDocument();
    expect(first!.querySelector('.project-visual-switcher__panel[aria-hidden="true"]')).toHaveAttribute("inert");
    fireEvent.keyDown(firstToggle, { key: "Home" });
    expect(firstToggle).toHaveAccessibleName("Show how Compliance Label Assistant works");
    fireEvent.keyDown(firstToggle, { key: "End" });
    expect(firstToggle).toHaveAccessibleName("Show preview for Compliance Label Assistant");
  });

  it("server-renders the initial preview and keeps the static fallback native and linked", () => {
    const enhancedMarkup = renderToStaticMarkup(<ProjectCard item={complianceProject} variant="detail" />);
    const staticMarkup = renderToStaticMarkup(<ProjectCard item={complianceProject} staticVisual variant="detail" />);
    expect(enhancedMarkup).toContain('data-view="preview"');
    expect(enhancedMarkup).toContain("How it works");
    expect(enhancedMarkup).toContain("Preview");
    expect(enhancedMarkup).not.toContain("project-visual-switcher__hint");
    expect(staticMarkup).toContain("<details");
    expect(staticMarkup).toContain("<summary>How it works</summary>");
    expect(staticMarkup).toContain("https://github.com/nicolasgioanni/Compliance-Label-Assistant");
    expect(staticMarkup).not.toContain("project-visual-switcher__toggle");
  });

  it("keeps a no-source static workflow diagram available without a media link", () => {
    const markup = renderToStaticMarkup(
      <ProjectCard
        item={{ ...complianceProject, links: [] }}
        staticVisual
        variant="detail"
      />,
    );
    expect(markup).toContain("project-visual-static__details");
    expect(markup).toContain("Label image to reviewer results");
    expect(markup).not.toContain("View source");
  });

  it("keeps unknown projects authored without a fabricated badge or workflow", () => {
    const { container } = render(<ProjectCard item={{ ...complianceProject, id: "unlisted-project", title: "Authored fallback" }} variant="detail" />);
    expect(container.querySelector(".project-visual-switcher")).not.toBeInTheDocument();
    expect(container.querySelector(".project-card__badge")).not.toBeInTheDocument();
    expect(container.querySelector(".project-card__image")).toBeInTheDocument();
  });

  it("keeps the typed NotePal attribution inline with the summary in enhanced and static output", () => {
    const notePal = { ...complianceProject, id: "notepal", title: "NotePal" };
    const { container } = render(<ProjectCard item={notePal} variant="detail" />);
    const summary = container.querySelector<HTMLElement>(".project-card__showcase-header .content-card__summary");
    const footer = container.querySelector<HTMLElement>(".project-card__footer");
    const link = within(summary!).getByRole("link", { name: "Parth Gupta" });

    expect(summary).toHaveTextContent("Turns alcohol-label images into explainable field checks with AI extraction and deterministic verification. Co-developed with Parth Gupta.");
    expect(link).toHaveAttribute("href", "https://www.linkedin.com/in/parthgu/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector(".project-card__attribution-link-icon")).toHaveAttribute("aria-hidden", "true");
    expect(footer).not.toHaveTextContent("Co-developed with Parth Gupta.");
    expect(footer?.querySelector(".project-card__footer-divider")?.compareDocumentPosition(footer.querySelector(".project-card__actions")!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const staticMarkup = renderToStaticMarkup(<ProjectCard item={notePal} staticVisual variant="detail" />);
    expect(staticMarkup).toContain("Co-developed with ");
    expect(staticMarkup).toContain('href="https://www.linkedin.com/in/parthgu/"');
    expect(staticMarkup).toContain("Parth Gupta");
  });

  it("renders the no-JavaScript route fallback with source-first actions", () => {
    const markup = renderToStaticMarkup(<ProjectsNoScriptFallback items={[complianceProject]} />);
    expect(markup).toMatch(/<h1[^>]*>Projects<\/h1>/);
    expect(markup).toContain("<details");
    expect(markup.indexOf("Source code for Compliance Label Assistant")).toBeLessThan(markup.indexOf("Live demo for Compliance Label Assistant"));
  });
});
