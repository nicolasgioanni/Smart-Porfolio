import type { ResearchItem } from "@/content/types";
import {
  isSupportedResearchCaptionPath,
  isSupportedResearchTranscriptPath,
  isSupportedResearchVideoPath
} from "@/lib/content/validatePortfolioContent";

export type ResearchVideo = {
  captionsSrc: string;
  description: string;
  durationLabel: string;
  height: number;
  mimeType: "video/mp4" | "video/webm";
  source: "canonical" | "curated";
  src: string;
  transcriptSrc: string;
  width: number;
};

type CuratedResearchVideo = Omit<ResearchVideo, "source">;

const curatedResearchVideos: Readonly<Record<string, CuratedResearchVideo>> = {
  "cytocv-miller-lab": {
    captionsSrc: "/images/research/cytocv-supplementary-video-s1.en.vtt",
    description:
      "A narrated CytoCV workflow demonstration showing nuclear-to-cytoplasmic intensity-ratio analysis for wild-type and mutant yeast cells.",
    durationLabel: "5 min 28 sec",
    height: 1108,
    mimeType: "video/mp4",
    src: "/images/research/cytocv-supplementary-video-s1.mp4",
    transcriptSrc: "/images/research/cytocv-supplementary-video-s1-transcript.txt",
    width: 1710
  }
};

function hasSafeAccessibilityResources(video: CuratedResearchVideo): boolean {
  return (
    isSupportedResearchVideoPath(video.src) &&
    isSupportedResearchCaptionPath(video.captionsSrc) &&
    isSupportedResearchTranscriptPath(video.transcriptSrc)
  );
}

export function getResearchVideo(item: Pick<ResearchItem, "id" | "video">): ResearchVideo | undefined {
  const canonicalSrc = item.video;
  const hasCanonicalSrc = Boolean(canonicalSrc);
  const curated = Object.prototype.hasOwnProperty.call(curatedResearchVideos, item.id)
    ? curatedResearchVideos[item.id]
    : undefined;

  if (hasCanonicalSrc) {
    if (
      !canonicalSrc ||
      !curated ||
      !hasSafeAccessibilityResources(curated) ||
      !isSupportedResearchVideoPath(canonicalSrc) ||
      canonicalSrc !== curated.src
    ) {
      return undefined;
    }

    return { ...curated, source: "canonical" };
  }

  return curated && hasSafeAccessibilityResources(curated) ? { ...curated, source: "curated" } : undefined;
}
