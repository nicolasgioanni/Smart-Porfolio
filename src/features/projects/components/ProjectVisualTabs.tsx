"use client";

import { useId, useRef, useState } from "react";
import { ProjectDiagramLink, ProjectPreview } from "@/features/projects/components/ProjectVisualContent";
import type { ProjectAction } from "@/features/projects/selectors/projectActions";
import type { ProjectVisual } from "@/features/projects/selectors/projectVisualRegistry";

type ProjectVisualTabsProps = {
  diagramAction?: ProjectAction;
  previewAction?: ProjectAction;
  projectId: string;
  projectTitle: string;
  visual: ProjectVisual;
};

type VisualView = "preview" | "workflow";

export function ProjectVisualTabs({ diagramAction, previewAction, projectId, projectTitle, visual }: ProjectVisualTabsProps) {
  const [selectedView, setSelectedView] = useState<VisualView>("preview");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const identifier = useId().replace(/:/g, "");
  const showingWorkflow = selectedView === "workflow";
  const previewPanelId = `${projectId}-${identifier}-preview`;
  const workflowPanelId = `${projectId}-${identifier}-workflow`;

  function selectView(view: VisualView, focus = false) {
    setSelectedView(view);
    if (focus) requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const nextView = event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "End"
      ? "workflow"
      : event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home"
        ? "preview"
        : undefined;
    if (!nextView) return;
    event.preventDefault();
    selectView(nextView, true);
  }

  return (
    <section aria-label={`Project preview for ${projectTitle}`} className="project-visual-switcher" data-project-visual={projectId} data-view={selectedView}>
      <div className="project-visual-switcher__viewport">
        <div className="project-visual-switcher__media">
          <div className="project-visual-switcher__scene">
            <div className="project-visual-switcher__track" data-view={selectedView}>
              <div aria-hidden={showingWorkflow} className="project-visual-switcher__panel" id={previewPanelId} inert={showingWorkflow}>
                <ProjectPreview action={previewAction} preview={visual.preview} />
              </div>
              <div aria-hidden={!showingWorkflow} className="project-visual-switcher__panel project-visual-switcher__panel--workflow" id={workflowPanelId} inert={!showingWorkflow}>
                <ProjectDiagramLink action={diagramAction} diagram={visual.diagram} id={`${projectId}-${identifier}`} projectId={projectId} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="project-visual-switcher__controls">
        <span className="visually-hidden" id={`${projectId}-${identifier}-view-status`}>Showing {showingWorkflow ? "how it works" : "preview"}</span>
        <button
          aria-controls={showingWorkflow ? previewPanelId : workflowPanelId}
          aria-describedby={`${projectId}-${identifier}-view-status`}
          aria-label={showingWorkflow ? `Show preview for ${projectTitle}` : `Show how ${projectTitle} works`}
          className="project-visual-switcher__toggle hover-base-1"
          onClick={() => selectView(showingWorkflow ? "preview" : "workflow")}
          onKeyDown={onKeyDown}
          ref={buttonRef}
          type="button"
        >
          <span aria-hidden="true" className="project-visual-switcher__toggle-label" data-view="workflow">How it works</span>
          <span aria-hidden="true" className="project-visual-switcher__toggle-label" data-view="preview">Preview</span>
        </button>
      </div>
    </section>
  );
}
