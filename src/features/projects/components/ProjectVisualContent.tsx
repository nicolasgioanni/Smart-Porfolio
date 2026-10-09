import { SmartLink } from "@/components/navigation/SmartLink";
import { ProjectDiagram } from "@/features/projects/components/ProjectDiagram";
import { LeetNotesPreview } from "@/features/projects/components/LeetNotesPreview";
import { getProjectDestinationHint, type ProjectAction } from "@/features/projects/selectors/projectActions";
import type { ProjectVisual } from "@/features/projects/selectors/projectVisualRegistry";

type ProjectPreviewProps = {
  action?: ProjectAction;
  preview: ProjectVisual["preview"];
};

export function ProjectPreview({ action, preview }: ProjectPreviewProps) {
  const content = preview.kind === "leetnotes"
    ? <LeetNotesPreview />
    : preview.mobile ? (
      <picture>
        <source media="(max-width: 720px)" srcSet={preview.mobile.src} type="image/webp" />
        <img alt={preview.alt} className={`project-visual-switcher__image project-visual-switcher__image--${preview.fit}`} height={preview.height} loading="lazy" src={preview.src} width={preview.width} />
      </picture>
    ) : <img alt={preview.alt} className={`project-visual-switcher__image project-visual-switcher__image--${preview.fit}`} height={preview.height} loading="lazy" src={preview.src} width={preview.width} />;

  return action ? (
    <SmartLink aria-label={`${getProjectDestinationHint(action)} project preview`} className="project-visual-switcher__media-link" href={action.link.url}>
      {content}
    </SmartLink>
  ) : content;
}

type ProjectDiagramLinkProps = {
  action?: ProjectAction;
  diagram: ProjectVisual["diagram"];
  id: string;
  projectId: string;
};

export function ProjectDiagramLink({ action, diagram, id, projectId }: ProjectDiagramLinkProps) {
  const content = <ProjectDiagram diagram={diagram} id={id} projectId={projectId} />;

  return action ? (
    <SmartLink aria-label={`${getProjectDestinationHint(action)} project workflow`} className="project-visual-switcher__media-link" href={action.link.url}>
      {content}
    </SmartLink>
  ) : content;
}
