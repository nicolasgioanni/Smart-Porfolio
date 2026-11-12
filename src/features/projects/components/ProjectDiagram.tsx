import type { ProjectDiagram as ProjectDiagramContent } from "@/features/projects/selectors/projectVisualRegistry";

type ProjectDiagramProps = {
  diagram: ProjectDiagramContent;
  id: string;
  projectId: string;
};

export function ProjectDiagram({ diagram, id, projectId }: ProjectDiagramProps) {
  const markerId = `project-diagram-arrow-${id}`;

  return (
    <figure aria-describedby={`${id}-diagram-description`} aria-labelledby={`${id}-diagram-title`} className={`project-diagram project-diagram--${projectId}`}>
      <figcaption className="visually-hidden" id={`${id}-diagram-title`}>{diagram.title}</figcaption>
      <p className="visually-hidden" id={`${id}-diagram-description`}>{diagram.description}</p>
      <svg aria-hidden="true" className="project-diagram__geometry" viewBox="0 0 600 320">
        <defs>
          <marker id={markerId} markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
            <path className="project-diagram__arrow" d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>
        <path className="project-diagram__track" d={getTrack(projectId)} markerEnd={`url(#${markerId})`} />
        <ProjectDiagramMotif projectId={projectId} />
      </svg>
      <ol className="project-diagram__nodes">
        {diagram.nodes.map((node, index) => (
          <li className="project-diagram__node" key={node.label} style={{ left: `${(node.x / 600) * 100}%`, top: `${(node.y / 320) * 100}%` }}>
            <span className="project-diagram__step">{String(index + 1).padStart(2, "0")}</span>
            <span className="project-diagram__label">{node.label}</span>
            {node.detail ? <span className="project-diagram__detail">{node.detail}</span> : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function getTrack(projectId: string): string {
  if (projectId === "notepal") return "M88 178 C130 178 132 122 210 122 H326 C385 122 385 178 510 178";
  if (projectId === "tergion-technologies") return "M88 164 C132 102 190 102 226 164 S332 226 374 164 S454 102 510 164";
  if (projectId === "leetnotes") return "M88 192 H178 V142 H326 V192 H510";
  if (projectId === "clair") return "M88 148 H178 V198 H326 V148 H510";
  return "M88 160 H510";
}

function ProjectDiagramMotif({ projectId }: { projectId: string }) {
  if (projectId === "compliance-label-assistant") {
    return <g className="project-diagram__motif"><rect height="88" rx="10" width="66" x="267" y="28" /><path d="M282 52h36M282 70h22M282 88h30M292 104l9 8 18-22" /></g>;
  }
  if (projectId === "notepal") {
    return <g className="project-diagram__motif"><path d="M266 36h68v70h-68zM276 52h44M276 68h44M276 84h30M252 48h-30v48h30M348 48h30v48h-30" /></g>;
  }
  if (projectId === "tergion-technologies") {
    return <g className="project-diagram__motif"><rect height="50" rx="7" width="84" x="258" y="34" /><path d="m258 42 42 29 42-29M258 78l28-25M342 78l-28-25" /></g>;
  }
  if (projectId === "leetnotes") {
    return <g className="project-diagram__motif"><rect height="62" rx="7" width="82" x="259" y="30" /><path d="M279 30v62M300 30v62M321 30v62M259 50h82M259 71h82" /></g>;
  }
  return <g className="project-diagram__motif"><path d="M256 49h38l10 12h40v47h-88zM256 49v59" /><path d="M276 76h47M276 92h31" /></g>;
}
