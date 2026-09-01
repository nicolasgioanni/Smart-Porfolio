import { describe, expect, it } from "vitest";
import { getResearchVideo } from "@/lib/content/researchVideos";

const curatedVideo = {
  captionsSrc: "/images/research/cytocv-supplementary-video-s1.en.vtt",
  description:
    "A narrated CytoCV workflow demonstration showing nuclear-to-cytoplasmic intensity-ratio analysis for wild-type and mutant yeast cells.",
  durationLabel: "5 min 28 sec",
  height: 1108,
  mimeType: "video/mp4",
  src: "/images/research/cytocv-supplementary-video-s1.mp4",
  transcriptSrc: "/images/research/cytocv-supplementary-video-s1-transcript.txt",
  width: 1710
};

describe("getResearchVideo", () => {
  it("supplies the reviewed CytoCV video when legacy content has no media field", () => {
    expect(getResearchVideo({ id: "cytocv-miller-lab" })).toEqual({
      ...curatedVideo,
      source: "curated"
    });
  });

  it("marks the exact canonical CytoCV path without weakening its accessibility metadata", () => {
    expect(
      getResearchVideo({
        id: "cytocv-miller-lab",
        video: "/images/research/cytocv-supplementary-video-s1.mp4"
      })
    ).toEqual({ ...curatedVideo, source: "canonical" });
  });

  it.each([
    "https://example.test/video.mp4",
    "//example.test/video.mp4",
    "/images/research/../private.mp4",
    "/images/research/%252e%252e/private.mp4",
    "/images/research/video.mp4?download=1",
    "/images/research/video.mp4#preview",
    "/images/research/video movie.mp4",
    "/images/research/video.mov",
    " /images/research/cytocv-supplementary-video-s1.mp4"
  ])("rejects an unsafe or unregistered canonical path without falling back: %s", (video) => {
    expect(getResearchVideo({ id: "cytocv-miller-lab", video })).toBeUndefined();
  });

  it.each([
    "/images/research/cytocv-supplementary-video-s1.en.vtt?download=1",
    "https://example.test/captions.vtt",
    "/images/research/cytocv-supplementary-video-s1-transcript.txt#top",
    "/images/research/../cytocv-supplementary-video-s1.mp4"
  ])("does not accept a media path that bypasses the local resource boundary: %s", (path) => {
    expect(
      getResearchVideo({
        id: "cytocv-miller-lab",
        video: path
      })
    ).toBeUndefined();
  });

  it("does not resolve unknown or prototype-derived project IDs", () => {
    expect(getResearchVideo({ id: "unknown" })).toBeUndefined();
    expect(getResearchVideo({ id: "toString" })).toBeUndefined();
    expect(getResearchVideo({ id: "__proto__" })).toBeUndefined();
  });
});
