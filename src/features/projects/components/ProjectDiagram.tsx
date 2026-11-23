import type { ProjectDiagram as ProjectDiagramContent, ProjectDiagramNode } from "@/features/projects/selectors/projectVisualRegistry";

type ProjectDiagramProps = {
  diagram: ProjectDiagramContent;
  id: string;
  projectId: string;
};

// Slots follow a fixed two-column grid. Edges connect adjacent component boundaries.
function edgePath(from: ProjectDiagramNode["slot"], to: ProjectDiagramNode["slot"]): string {
  const fromColumn = from % 2;
  const toColumn = to % 2;
  const fromRow = Math.floor(from / 2);
  const toRow = Math.floor(to / 2);
  const centerX = (column: number) => column === 0 ? 24 : 76;
  const centerY = (row: number) => 16 + row * 34;
  if (fromRow !== toRow && fromColumn !== toColumn) {
    return `M ${fromColumn === 0 ? 40 : 60} ${centerY(fromRow) + (toRow > fromRow ? 13 : -13)} L ${toColumn === 0 ? 40 : 60} ${centerY(toRow) + (toRow > fromRow ? -13 : 13)}`;
  }
  if (fromRow === toRow) {
    return `M ${fromColumn === 0 ? 44 : 56} ${centerY(fromRow)} L ${toColumn === 0 ? 44 : 56} ${centerY(toRow)}`;
  }
  return `M ${centerX(fromColumn)} ${centerY(fromRow) + (toRow > fromRow ? 13 : -13)} L ${centerX(toColumn)} ${centerY(toRow) + (toRow > fromRow ? -13 : 13)}`;
}

export function ProjectDiagram({ diagram, id, projectId }: ProjectDiagramProps) {
  const markerId = `project-diagram-arrow-${id}`;

  return (
    <figure aria-describedby={`${id}-diagram-description`} aria-labelledby={`${id}-diagram-title`} className={`project-diagram project-diagram--${projectId}`}>
      <figcaption className="visually-hidden" id={`${id}-diagram-title`}>{diagram.title}</figcaption>
      <p className="visually-hidden" id={`${id}-diagram-description`}>{diagram.description}</p>
      <svg aria-hidden="true" className="project-diagram__geometry" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <marker id={markerId} markerHeight="3" markerUnits="userSpaceOnUse" markerWidth="3" orient="auto-start-reverse" refX="2.5" refY="1.5">
            <path className="project-diagram__arrow" d="M0,0 L3,1.5 L0,3 z" />
          </marker>
        </defs>
        {diagram.edges.map(({ bidirectional, from, to }) => <path className="project-diagram__edge" d={edgePath(from, to)} key={`${from}-${to}`} markerEnd={`url(#${markerId})`} markerStart={bidirectional ? `url(#${markerId})` : undefined} />)}
      </svg>
      <ul className="project-diagram__nodes">
        {diagram.nodes.map((node) => (
          <li className={`project-diagram__node project-diagram__node--${node.slot}`} key={node.slot}>
            <span className="project-diagram__role">{node.role}</span>
            <span className="project-diagram__label">{node.label}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
