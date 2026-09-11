import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchVideoPreview } from "@/components/portfolio/ResearchVideoPreview";

const graphicalAbstract = {
  alt: "A research workflow diagram.",
  height: 941,
  source: "curated" as const,
  src: "/images/research/cytocv-graphical-abstract.png",
  width: 1672
};

const video = {
  captionsSrc: "/images/research/cytocv-supplementary-video-s1.en.vtt",
  description: "A narrated scientific workflow.",
  durationLabel: "5 min 28 sec",
  height: 1108,
  mimeType: "video/mp4" as const,
  source: "curated" as const,
  src: "/images/research/cytocv-supplementary-video-s1.mp4",
  transcriptSrc: "/images/research/cytocv-supplementary-video-s1-transcript.txt",
  width: 1710
};

function setMediaTimeline(element: HTMLVideoElement, currentTime = 0, duration = 328.44) {
  Object.defineProperties(element, {
    currentTime: { configurable: true, value: currentTime, writable: true },
    duration: { configurable: true, value: duration }
  });
}

describe("ResearchVideoPreview", () => {
  const originalBodyOverflow = document.body.style.overflow;

  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = originalBodyOverflow;
  });

  it("renders a captioned, native-control player with readable and downloadable fallbacks", () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const player = container.querySelector<HTMLVideoElement>(".research-video__player");
    const transcript = screen.getByRole("link", { name: "Read transcript" });
    const download = screen.getByRole("link", { name: "Download MP4" });
    const openButton = screen.getByRole("button", { name: "Expand video for Example Research" });

    expect(player).not.toBeNull();
    expect(player).toHaveAttribute("controls");
    expect(player).toHaveAttribute("playsinline");
    expect(player).toHaveAttribute("preload", "metadata");
    expect(player).not.toHaveAttribute("autoplay");
    expect(player).not.toHaveAttribute("controlslist");
    expect(player).not.toHaveAttribute("disablepictureinpicture");
    expect(player?.querySelector("source")).toHaveAttribute("type", "video/mp4");
    expect(player?.querySelector("track")).toHaveAttribute("kind", "captions");
    expect(player?.querySelector("track")).toHaveAttribute("src", video.captionsSrc);
    expect(player?.querySelector("track")).toHaveAttribute("default");
    expect(transcript).toHaveAttribute("href", video.transcriptSrc);
    expect(download).toHaveAttribute("href", video.src);
    expect(download).toHaveAttribute("download");
    expect(openButton).toHaveAttribute("aria-haspopup", "dialog");
    expect(openButton).toHaveAttribute("aria-expanded", "false");
  });

  it("uses the shared modal lifecycle and resets playback on close, Escape, and rapid reopen", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const inlinePlayer = container.querySelector<HTMLVideoElement>(".research-video__player")!;
    const openButton = screen.getByRole("button", { name: "Expand video for Example Research" });
    setMediaTimeline(inlinePlayer, 27);
    const pauseInline = vi.spyOn(inlinePlayer, "pause");

    fireEvent.click(openButton);
    const dialog = await screen.findByRole("dialog", { name: "Example Research supplementary workflow video" });
    const closeButton = within(dialog).getByRole("button", { name: "Close video for Example Research" });
    const modalPlayer = dialog.querySelector<HTMLVideoElement>(".research-video-dialog__player")!;
    setMediaTimeline(modalPlayer, 19);
    const pauseModal = vi.spyOn(modalPlayer, "pause");

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(inlinePlayer.currentTime).toBe(0);
    expect(pauseInline).toHaveBeenCalled();
    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(modalPlayer.currentTime).toBe(0);
    expect(inlinePlayer.currentTime).toBe(0);
    expect(pauseModal).toHaveBeenCalled();

    fireEvent.click(openButton);
    const reopenedDialog = await screen.findByRole("dialog", { name: "Example Research supplementary workflow video" });
    const reopenedPlayer = reopenedDialog.querySelector<HTMLVideoElement>(".research-video-dialog__player")!;
    setMediaTimeline(reopenedPlayer, 0);
    expect(reopenedPlayer.currentTime).toBe(0);
    fireEvent.click(within(reopenedDialog).getByRole("button", { name: "Close video for Example Research" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
    expect(document.body.style.overflow).toBe(originalBodyOverflow);
  });

  it("announces loading, errors, and ended playback without blocking the fallbacks", () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const player = container.querySelector<HTMLVideoElement>(".research-video__player")!;

    fireEvent.error(player);
    expect(screen.getByRole("status")).toHaveTextContent("Video playback is unavailable");
    expect(screen.getByRole("link", { name: "Read transcript" })).toBeInTheDocument();

    fireEvent.ended(player);
    expect(screen.getByRole("status")).toHaveTextContent("Video ended");

    fireEvent.loadStart(player);
    expect(screen.getByRole("status")).toHaveTextContent("Loading video metadata");
  });
});
