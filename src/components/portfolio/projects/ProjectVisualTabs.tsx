"use client";

import { useId, useRef, useState } from "react";
import type { ProjectVisual } from "@/lib/projects/projectVisualRegistry";
import { ProjectDiagram } from "@/components/portfolio/projects/ProjectDiagram";

type ProjectVisualTabsProps = {
  projectId: string;
  projectTitle: string;
  visual: ProjectVisual;
};

const viewLabels = ["Concept", "How it works"] as const;
type VisualView = (typeof viewLabels)[number];

export function ProjectVisualTabs({ projectId, projectTitle, visual }: ProjectVisualTabsProps) {
  const [selectedView, setSelectedView] = useState<VisualView>("Concept");
  const identifier = useId().replace(/:/g, "");
  const tabIds = viewLabels.map((view) => `${projectId}-${identifier}-${view.toLowerCase().replaceAll(" ", "-")}-tab`);
  const panelIds = viewLabels.map((view) => `${projectId}-${identifier}-${view.toLowerCase().replaceAll(" ", "-")}-panel`);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = viewLabels.indexOf(selectedView);

  function selectView(index: number, focus = false) {
    setSelectedView(viewLabels[index]!);
    if (focus) tabRefs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % viewLabels.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + viewLabels.length) % viewLabels.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = viewLabels.length - 1;

    if (nextIndex !== undefined) {
      event.preventDefault();
      selectView(nextIndex, true);
    }
  }

  return (
    <section aria-label={`Visual overview for ${projectTitle}`} className="project-visual-tabs">
      <div className="project-visual-tabs__enhanced">
        <div aria-label="Project visual view" className="project-visual-tabs__list" role="tablist">
          {viewLabels.map((view, index) => (
            <button
              aria-controls={panelIds[index]}
              aria-selected={selectedIndex === index}
              className="project-visual-tabs__tab"
              id={tabIds[index]}
              key={view}
              onClick={() => selectView(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              ref={(element) => { tabRefs.current[index] = element; }}
              role="tab"
              tabIndex={selectedIndex === index ? 0 : -1}
              type="button"
            >
              {view}
            </button>
          ))}
        </div>
        <div
          aria-labelledby={tabIds[0]}
          className="project-visual-tabs__panel"
          hidden={selectedView !== "Concept"}
          id={panelIds[0]}
          role="tabpanel"
        >
          <img
            alt={visual.concept.alt}
            className="project-visual-tabs__image"
            height={visual.concept.height}
            loading="lazy"
            src={visual.concept.src}
            width={visual.concept.width}
          />
        </div>
        <div
          aria-labelledby={tabIds[1]}
          className="project-visual-tabs__panel project-visual-tabs__panel--diagram"
          hidden={selectedView !== "How it works"}
          id={panelIds[1]}
          role="tabpanel"
        >
          <ProjectDiagram diagram={visual.diagram} id={`${projectId}-${identifier}`} projectId={projectId} />
        </div>
      </div>
      {visual.diagram.attribution ? <p className="project-visual-tabs__attribution">{visual.diagram.attribution}</p> : null}
      <noscript>
        <style>{`.project-visual-tabs__enhanced { display: none !important; }`}</style>
        <figure className="project-visual-tabs__native-concept">
          <img alt={visual.concept.alt} height={visual.concept.height} loading="lazy" src={visual.concept.src} width={visual.concept.width} />
        </figure>
        {visual.diagram.attribution ? <p className="project-visual-tabs__attribution">{visual.diagram.attribution}</p> : null}
        <details className="project-visual-tabs__native-details">
          <summary>How it works</summary>
          <ProjectDiagram diagram={visual.diagram} id={`${projectId}-native`} projectId={projectId} />
        </details>
      </noscript>
    </section>
  );
}
