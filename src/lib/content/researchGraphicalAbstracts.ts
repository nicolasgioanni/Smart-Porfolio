import type { ResearchItem } from "@/content/types";
import { isSupportedResearchGraphicalAbstractPath } from "@/lib/content/validatePortfolioContent";

export type ResearchGraphicalAbstract = {
  alt: string;
  height?: number;
  source: "canonical" | "curated";
  src: string;
  width?: number;
};

type CuratedGraphicalAbstract = Omit<ResearchGraphicalAbstract, "source">;

const curatedGraphicalAbstracts: Readonly<Record<string, CuratedGraphicalAbstract>> = {
  "cytocv-miller-lab": {
    alt: "Four-step CytoCV workflow from yeast microscopy channels through segmentation and fluorescence measurement to reviewable CSV/XLSX export.",
    height: 941,
    src: "/images/research/cytocv-graphical-abstract.png",
    width: 1672
  },
  "adversarial-machine-learning": {
    alt: "Four-step adversarial machine-learning study showing image-classification data and models, attack experiments, defense experiments, and evaluation outputs.",
    height: 2160,
    src: "/images/research/independent-study-graphical-abstract.png",
    width: 3840
  },
  "yeast-dna-target-selection": {
    alt: "Four-step GuideDonorScheduler workflow from FASTA input through guide selection and donor design to annotated XLS output.",
    height: 2160,
    src: "/images/research/guide-donor-scheduler-graphical-abstract.png",
    width: 3840
  }
};

export function getResearchGraphicalAbstract(
  item: Pick<ResearchItem, "graphicalAbstract" | "graphicalAbstractAlt" | "id">
): ResearchGraphicalAbstract | undefined {
  const canonicalSrc = item.graphicalAbstract;
  const canonicalAlt = item.graphicalAbstractAlt?.trim();
  const hasCanonicalSrc = Boolean(canonicalSrc);
  const hasCanonicalAlt = Boolean(item.graphicalAbstractAlt);
  const curated = Object.prototype.hasOwnProperty.call(curatedGraphicalAbstracts, item.id)
    ? curatedGraphicalAbstracts[item.id]
    : undefined;

  if (hasCanonicalSrc && hasCanonicalAlt) {
    if (!canonicalSrc || !canonicalAlt || !isSupportedResearchGraphicalAbstractPath(canonicalSrc)) {
      return undefined;
    }

    const dimensions = curated?.src === canonicalSrc ? { height: curated.height, width: curated.width } : {};

    return {
      alt: canonicalAlt,
      ...dimensions,
      source: "canonical",
      src: canonicalSrc
    };
  }

  if (hasCanonicalSrc || hasCanonicalAlt) return undefined;

  return curated ? { ...curated, source: "curated" } : undefined;
}
