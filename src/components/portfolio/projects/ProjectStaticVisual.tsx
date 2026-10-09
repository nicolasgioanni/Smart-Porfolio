import type { ProjectVisual } from "@/lib/projects/projectVisualRegistry";
import { ProjectDiagram } from "@/components/portfolio/projects/ProjectDiagram";

type ProjectStaticVisualProps = {
  projectId: string;
  projectTitle: string;
  visual: ProjectVisual;
};

/** Native static-export visual for visitors who have not enabled JavaScript. */
export function ProjectStaticVisual({ projectId, projectTitle, visual }: ProjectStaticVisualProps) {
  return (
    <section aria-label={`Visual overview for ${projectTitle}`} className="project-visual-tabs">
      <figure className="project-visual-tabs__native-concept">
        <img alt={visual.concept.alt} height={visual.concept.height} loading="lazy" src={visual.concept.src} width={visual.concept.width} />
      </figure>
      {visual.diagram.attribution ? <p className="project-visual-tabs__attribution">{visual.diagram.attribution}</p> : null}
      <details className="project-visual-tabs__native-details">
        <summary>How it works</summary>
        <ProjectDiagram diagram={visual.diagram} id={`${projectId}-static`} projectId={projectId} />
      </details>
    </section>
  );
}
