import type { ResearchItem } from "@/content/types";
import { ResearchGraphicalAbstractPreview } from "@/components/portfolio/research/ResearchGraphicalAbstractPreview";
import { ResearchVideoPreview } from "@/components/portfolio/research/ResearchVideoPreview";
import { getResearchGraphicalAbstract } from "@/lib/content/researchGraphicalAbstracts";
import { getResearchVideo } from "@/lib/content/researchVideos";

type ResearchProjectVisualProps = {
  item: ResearchItem;
  order: number;
  title: string;
};

function FallbackVisual() {
  return (
    <svg aria-label="Research system diagram" className="research-visual__svg" role="img" viewBox="0 0 480 340">
      <path className="research-visual__orbit" d="M102 170c0-75 62-136 138-136s138 61 138 136-62 136-138 136-138-61-138-136Z" />
      <path className="research-visual__boundary" d="M80 254 400 86" />
      <circle className="research-visual__node" cx="150" cy="217" r="8" />
      <circle className="research-visual__node" cx="240" cy="170" r="8" />
      <circle className="research-visual__node" cx="330" cy="123" r="8" />
    </svg>
  );
}

export function ResearchProjectVisual({ item, order, title }: ResearchProjectVisualProps) {
  const graphicalAbstract = getResearchGraphicalAbstract(item);
  const video = getResearchVideo(item);

  if (graphicalAbstract && video) {
    return (
      <div className="research-media-stack">
        <ResearchVideoPreview poster={graphicalAbstract} title={title} video={video} />
        <ResearchGraphicalAbstractPreview abstract={graphicalAbstract} title={title} />
      </div>
    );
  }

  if (graphicalAbstract) {
    return <ResearchGraphicalAbstractPreview abstract={graphicalAbstract} title={title} />;
  }

  return (
    <figure className="research-visual">
      <div className="research-visual__header">
        <span>R&amp;D / {String(order + 1).padStart(2, "0")}</span>
        <span className="research-visual__status">
          <span aria-hidden="true" className="research-visual__status-dot" />
          Active
        </span>
      </div>
      <div className="research-visual__canvas">
        <FallbackVisual />
      </div>
      <figcaption className="research-visual__caption">
        <span aria-hidden="true" className="research-visual__monogram">
          R&amp;D
        </span>
        <span>
          <strong>Research system</strong>
          Observe · test · learn
        </span>
      </figcaption>
    </figure>
  );
}
