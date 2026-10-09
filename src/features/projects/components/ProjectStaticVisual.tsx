import { ProjectDiagramLink, ProjectPreview } from "@/features/projects/components/ProjectVisualContent";
import type { ProjectAction } from "@/features/projects/selectors/projectActions";
import type { ProjectVisual } from "@/features/projects/selectors/projectVisualRegistry";

type ProjectStaticVisualProps = {
  diagramAction?: ProjectAction;
  previewAction?: ProjectAction;
  projectId: string;
  projectTitle: string;
  visual: ProjectVisual;
};

/** Native static-export visual for visitors who have not enabled JavaScript. */
export function ProjectStaticVisual({ diagramAction, previewAction, projectId, projectTitle, visual }: ProjectStaticVisualProps) {
  return (
    <div aria-label={`Project preview for ${projectTitle}`} className="project-visual-static">
      <div className="project-visual-static__preview">
        <ProjectPreview action={previewAction} preview={visual.preview} />
      </div>
      <details className="project-visual-static__details">
        <summary>How it works</summary>
        <ProjectDiagramLink action={diagramAction} diagram={visual.diagram} id={`${projectId}-static`} projectId={projectId} />
      </details>
    </div>
  );
}
