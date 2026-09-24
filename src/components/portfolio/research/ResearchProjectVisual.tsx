import type { ResearchItem } from "@/content/types";
import { ResearchGraphicalAbstractPreview } from "@/components/portfolio/research/ResearchGraphicalAbstractPreview";
import { ResearchExplainer, type ResearchExplainerVariant } from "@/components/portfolio/research/ResearchExplainer";
import { ResearchVideoPreview } from "@/components/portfolio/research/ResearchVideoPreview";
import { getResearchGraphicalAbstract } from "@/lib/content/researchGraphicalAbstracts";
import { getResearchVideo } from "@/lib/content/researchVideos";

type ResearchProjectVisualProps = {
  item: ResearchItem;
  order: number;
  title: string;
};

/** Keep authored media selection tied to the stable generated Research ids. */
export function getResearchExplainerVariant(itemId: string): ResearchExplainerVariant | undefined {
  if (itemId === "adversarial-machine-learning") return "aml";
  if (itemId === "yeast-dna-target-selection") return "guide-donor";
  return undefined;
}

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
  const explainerVariant = getResearchExplainerVariant(item.id);

  if (graphicalAbstract && (video || explainerVariant)) {
    return (
      <div className="research-media-stack">
        <div className="research-project__media-row research-project__media-row--abstract">
          <ResearchGraphicalAbstractPreview abstract={graphicalAbstract} title={title} />
        </div>
        <div aria-hidden="true" className="research-project__media-divider" />
        <div className="research-project__media-row research-project__media-row--explainer">
          {video ? <ResearchVideoPreview poster={graphicalAbstract} title={title} video={video} /> : null}
          {explainerVariant ? <ResearchExplainer variant={explainerVariant} /> : null}
        </div>
      </div>
    );
  }

  if (graphicalAbstract) {
    return <ResearchGraphicalAbstractPreview abstract={graphicalAbstract} title={title} />;
  }

  return (
    <figure className="research-visual">
      <div className="research-visual__header">
        <span>R&amp;D / {order + 1}</span>
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
