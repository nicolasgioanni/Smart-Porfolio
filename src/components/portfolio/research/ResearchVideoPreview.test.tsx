import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchVideoPreview } from "@/components/portfolio/research/ResearchVideoPreview";

const graphicalAbstract = {
  alt: "A research workflow diagram.",
  displayTitle: "CytoCV Graphical Abstract",
  height: 941,
  source: "curated" as const,
  src: "/images/research/cytocv-graphical-abstract.png",
  width: 1672
};

const video = {
  captionsSrc: "/images/research/cytocv-supplementary-video-s1.en.vtt",
  description: "A narrated scientific workflow.",
  displayTitle: "CytoCV Demo",
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
    duration: { configurable: true, value: duration },
    muted: { configurable: true, value: false, writable: true },
    playbackRate: { configurable: true, value: 1, writable: true },
    volume: { configurable: true, value: 1, writable: true }
  });
}

function getInlineVideo(container: HTMLElement): HTMLVideoElement {
  return container.querySelector<HTMLVideoElement>("[data-testid='research-video-player'] .research-video-player__media")!;
}

function getInlinePlayer(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>("[data-testid='research-video-player']")!;
}

function revealPlayerControls(player: HTMLElement) {
  fireEvent.pointerEnter(player, { pointerType: "mouse" });
}

function fireTouchSurface(player: HTMLElement) {
  for (const type of ["pointerdown", "pointerup"]) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, "pointerType", { value: "touch" });
    fireEvent(player, event);
  }
}

function fireMousePointerMove(target: HTMLElement, clientX: number, clientY: number) {
  const event = new Event("pointermove", { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerType: { value: "mouse" }
  });
  fireEvent(target, event);
}

function rectangle(left: number, top: number, right: number, bottom: number): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    toJSON: () => ({}),
    top,
    width: right - left,
    x: left,
    y: top
  } as DOMRect;
}

describe("ResearchVideoPreview", () => {
  const originalBodyOverflow = document.body.style.overflow;

  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.style.overflow = originalBodyOverflow;
  });

  it("server-renders a native, captioned fallback before custom controls hydrate", () => {
    const markup = renderToStaticMarkup(
      <ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />
    );

    expect(markup).toContain("controls=\"\"");
    expect(markup).toContain("preload=\"metadata\"");
    expect(markup).toContain("kind=\"captions\"");
    expect(markup).toContain(`src="${video.captionsSrc}"`);
    expect(markup).toContain("default=\"\"");
    expect(markup).toContain("Read transcript");
    expect(markup).not.toContain("research-video-player__top-bar");
    expect(markup).not.toContain("Loading video metadata.");
    expect(markup).not.toContain("research-video-player__status");
    expect(markup).not.toContain("autoplay");
  });

  it("enhances to the shared custom controls while keeping the direct transcript link", () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const player = getInlineVideo(container);
    const playerRoot = getInlinePlayer(container);
    const transcript = screen.getByTestId("read-transcript");
    const bottomControls = screen.getByTestId("research-video-bottom-controls");

    expect(playerRoot).toHaveAttribute("data-enhanced", "true");
    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");
    expect(player).not.toHaveAttribute("controls");
    expect(player).toHaveAttribute("playsinline");
    expect(player).toHaveAttribute("preload", "metadata");
    expect(player.querySelector("source")).toHaveAttribute("type", "video/mp4");
    expect(player.querySelector("track")).toHaveAttribute("kind", "captions");
    expect(player.querySelector("track")).toHaveAttribute("default");
    expect(transcript).toHaveAttribute("href", video.transcriptSrc);
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open enlarged player" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Play video" })).toHaveLength(1);
    expect(bottomControls).toHaveAttribute("aria-hidden", "true");
    expect(bottomControls).toHaveAttribute("inert");
    expect(playerRoot.querySelector(".research-video-player__top-bar")).toBeNull();
    expect(screen.getByTestId("video-settings")).toHaveAttribute("data-open", "false");
    expect(screen.getByTestId("video-volume-range")).toHaveAttribute("data-open", "false");
    expect(playerRoot.querySelector(".research-video-player__actions-left")).not.toBeNull();
    expect(playerRoot.querySelector(".research-video-player__actions-right")).not.toBeNull();
  });

  it("reveals the bottom controls only for an active pointer, touch surface, or keyboard focus", () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    const centerControl = screen.getByRole("button", { name: "Play video" });

    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");
    fireEvent.click(centerControl);
    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");

    revealPlayerControls(playerRoot);
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");
    fireEvent.pointerLeave(playerRoot, { pointerType: "mouse" });
    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");

    fireEvent.pointerMove(playerRoot, { pointerType: "mouse" });
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");
    fireEvent.pointerLeave(playerRoot, { pointerType: "mouse" });
    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");

    fireEvent.keyDown(centerControl, { key: "Tab" });
    centerControl.focus();
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");

    fireTouchSurface(playerRoot);
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");
    fireTouchSurface(playerRoot);
    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");
  });

  it("hides pointer controls after four idle seconds while retaining them for active playback feedback", () => {
    vi.useFakeTimers();
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    const player = getInlineVideo(container);

    revealPlayerControls(playerRoot);
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");

    act(() => vi.advanceTimersByTime(3_999));
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");
    act(() => vi.advanceTimersByTime(1));
    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");

    fireEvent.pointerMove(playerRoot, { pointerType: "mouse" });
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");
    act(() => vi.advanceTimersByTime(4_000));
    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");

    fireEvent.waiting(player);
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");
    fireEvent.playing(player);
    expect(playerRoot).toHaveAttribute("data-controls-visible", "false");
    fireEvent.error(player);
    expect(playerRoot).toHaveAttribute("data-controls-visible", "true");
  });

  it("keeps compact settings and the inline volume range mounted while closing pointer-open controls on exit", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    revealPlayerControls(playerRoot);

    const settingsButton = screen.getByRole("button", { name: "Open video settings" });
    fireEvent.click(settingsButton);
    const settings = screen.getByTestId("video-settings");
    expect(settings).toHaveAttribute("data-open", "true");
    fireEvent.pointerMove(playerRoot, { pointerType: "mouse" });
    expect(settings).toHaveAttribute("data-open", "true");
    fireEvent.click(within(settings).getByRole("button", { name: "Playback speed — 1×" }));
    expect(settings).toHaveAttribute("data-view", "speeds");
    fireEvent.pointerLeave(playerRoot, { pointerType: "mouse" });
    fireEvent.pointerMove(document.body, { clientX: 500, clientY: 500, pointerType: "mouse" });
    expect(settings).toHaveAttribute("data-open", "true");
    await waitFor(() => expect(settings).toHaveAttribute("data-open", "false"));
    expect(settings).toHaveAttribute("inert");

    revealPlayerControls(playerRoot);
    const soundButton = screen.getByRole("button", { name: "Mute video" });
    fireEvent.pointerEnter(soundButton, { pointerType: "mouse" });
    const volumeRange = screen.getByTestId("video-volume-range");
    expect(volumeRange).toHaveAttribute("data-open", "true");
    fireEvent.pointerLeave(playerRoot.querySelector(".research-video-player__sound")!, { pointerType: "mouse" });
    fireEvent.pointerMove(playerRoot, { pointerType: "mouse" });
    await waitFor(() => expect(volumeRange).toHaveAttribute("data-open", "false"));
    expect(volumeRange).toHaveAttribute("inert");
  });

  it("keeps pointer settings open through the trigger-to-panel corridor before applying its exit grace", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    revealPlayerControls(playerRoot);

    const settingsButton = screen.getByRole("button", { name: "Open video settings" });
    fireEvent.click(settingsButton);
    const settings = screen.getByTestId("video-settings");
    vi.spyOn(settingsButton, "getBoundingClientRect").mockReturnValue(rectangle(220, 220, 264, 264));
    vi.spyOn(settings, "getBoundingClientRect").mockReturnValue(rectangle(180, 110, 340, 204));

    fireMousePointerMove(document.body, 242, 212);
    await act(async () => await new Promise((resolve) => window.setTimeout(resolve, 200)));
    expect(settings).toHaveAttribute("data-open", "true");

    fireMousePointerMove(document.body, 500, 500);
    expect(settings).toHaveAttribute("data-open", "true");
    await waitFor(() => expect(settings).toHaveAttribute("data-open", "false"));
  });

  it("toggles sound while opening the inline volume range and restores sound focus after Escape", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    const player = getInlineVideo(container);
    revealPlayerControls(playerRoot);
    const soundButton = screen.getByRole("button", { name: "Mute video" });

    fireEvent.pointerDown(soundButton, { pointerType: "touch" });
    fireEvent.click(soundButton);
    const volumeRange = screen.getByTestId("video-volume-range");
    expect(volumeRange).toHaveAttribute("data-open", "true");
    expect(within(volumeRange).getByRole("slider", { name: "Volume" })).toBeInTheDocument();
    expect(player.muted).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Unmute video" }));
    expect(player.muted).toBe(false);

    const outsideTouch = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(outsideTouch, "pointerType", { value: "touch" });
    fireEvent(document.body, outsideTouch);
    expect(volumeRange).toHaveAttribute("data-open", "false");

    fireEvent.click(screen.getByRole("button", { name: "Mute video" }));
    expect(volumeRange).toHaveAttribute("data-open", "true");

    await act(async () => fireEvent.keyDown(volumeRange, { key: "Escape" }));
    expect(volumeRange).toHaveAttribute("data-open", "false");
    await waitFor(() => expect(screen.getByRole("button", { name: "Unmute video" })).toHaveFocus());
    expect(volumeRange).toHaveAttribute("data-open", "false");
  });

  it("keeps the inline volume range available while its slider has focus or is being dragged", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    revealPlayerControls(playerRoot);
    const sound = playerRoot.querySelector<HTMLElement>(".research-video-player__sound")!;
    fireEvent.pointerEnter(sound, { pointerType: "mouse" });

    const volumeRange = screen.getByTestId("video-volume-range");
    const slider = within(volumeRange).getByRole("slider", { name: "Volume" });
    fireEvent.focus(slider);
    fireEvent.pointerLeave(sound, { pointerType: "mouse" });
    await act(async () => await new Promise((resolve) => window.setTimeout(resolve, 200)));
    expect(volumeRange).toHaveAttribute("data-open", "true");

    fireEvent.pointerDown(slider, { pointerType: "mouse" });
    fireEvent.blur(slider);
    await act(async () => await new Promise((resolve) => window.setTimeout(resolve, 200)));
    expect(volumeRange).toHaveAttribute("data-open", "true");

    fireEvent.pointerUp(slider, { pointerType: "mouse" });
    await act(async () => fireEvent.keyDown(volumeRange, { key: "Escape" }));
    expect(volumeRange).toHaveAttribute("data-open", "false");
  });

  it("pauses and transfers timeline, volume, speed, and caption preference between the inline and enlarged players", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const inlinePlayer = getInlineVideo(container);
    const inlineRoot = getInlinePlayer(container);
    revealPlayerControls(inlineRoot);
    const settingsButton = screen.getByRole("button", { name: "Open video settings" });
    setMediaTimeline(inlinePlayer, 12.5);
    inlinePlayer.volume = 0.4;
    inlinePlayer.muted = true;
    inlinePlayer.playbackRate = 1.5;
    const pauseInline = vi.spyOn(inlinePlayer, "pause");

    fireEvent.click(screen.getByRole("button", { name: "Disable captions" }));
    fireEvent.click(settingsButton);
    fireEvent.click(within(screen.getByRole("group", { name: "Video settings" })).getByRole("button", { name: "Open enlarged player" }));
    const dialog = await screen.findByRole("dialog", { name: "Example Research supplementary workflow video" });
    const modalPlayer = dialog.querySelector<HTMLVideoElement>(".research-video-player__media")!;
    fireEvent.loadedMetadata(modalPlayer);
    const modalRoot = within(dialog).getByTestId("research-video-player");
    revealPlayerControls(modalRoot);

    expect(pauseInline).toHaveBeenCalled();
    expect(modalPlayer.currentTime).toBe(12.5);
    expect(modalPlayer.volume).toBe(0.4);
    expect(modalPlayer.muted).toBe(true);
    expect(modalPlayer.playbackRate).toBe(1.5);
    expect(within(dialog).getByRole("button", { name: "Enable captions" })).toHaveAttribute("aria-pressed", "false");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(within(dialog).getByRole("button", { name: "Unmute video" }));
    expect(modalPlayer.muted).toBe(false);
    expect(modalPlayer.volume).toBe(0.4);

    setMediaTimeline(modalPlayer, 46.25);
    modalPlayer.volume = 0.2;
    modalPlayer.playbackRate = 2;
    fireEvent.click(within(dialog).getByRole("button", { name: "Close video for Example Research" }));
    fireEvent.loadedMetadata(inlinePlayer);

    expect(inlinePlayer.currentTime).toBe(46.25);
    expect(inlinePlayer.volume).toBe(0.2);
    expect(inlinePlayer.playbackRate).toBe(2);
    await waitFor(() => expect(settingsButton).toHaveFocus());
    expect(within(inlineRoot).getByTestId("research-video-bottom-controls")).toHaveAttribute("aria-hidden", "false");
    expect(within(inlineRoot).getByTestId("research-video-bottom-controls")).not.toHaveAttribute("inert");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("opens a compact settings root, returns speed selection to it, and consumes Escape before the dialog lifecycle", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const player = getInlineVideo(container);
    const playerRoot = getInlinePlayer(container);
    revealPlayerControls(playerRoot);
    setMediaTimeline(player);
    const settingsButton = screen.getByRole("button", { name: "Open video settings" });

    fireEvent.click(settingsButton);
    const settings = screen.getByRole("group", { name: "Video settings" });
    const speedMenu = within(settings).getByRole("button", { name: "Playback speed — 1×" });
    speedMenu.focus();
    fireEvent.keyDown(speedMenu, { key: "Enter" });
    fireEvent.click(speedMenu);
    expect(settings).toHaveAttribute("data-view", "speeds");
    const selectedSpeed = within(settings).getByRole("button", { name: "1×" });
    await waitFor(() => expect(selectedSpeed).toHaveFocus());
    await act(async () => fireEvent.keyDown(selectedSpeed, { key: "Escape" }));
    expect(settings).toHaveAttribute("data-view", "root");
    await waitFor(() => expect(speedMenu).toHaveFocus());

    fireEvent.click(speedMenu);
    const speed = within(settings).getByRole("button", { name: "1.5×" });
    fireEvent.click(speed);
    expect(player.playbackRate).toBe(1.5);
    expect(speed).toHaveAttribute("aria-pressed", "true");
    expect(settings).toHaveAttribute("data-open", "true");
    expect(settings).toHaveAttribute("data-view", "root");
    await waitFor(() => expect(screen.getByRole("button", { name: "Playback speed — 1.5×" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Playback speed — 1.5×" }));
    await act(async () => fireEvent.keyDown(within(settings).getByRole("button", { name: "1×" }), { key: "Escape" }));
    expect(settings).toHaveAttribute("data-view", "root");
    await waitFor(() => expect(screen.getByRole("button", { name: "Playback speed — 1.5×" })).toHaveFocus());

    await act(async () => fireEvent.keyDown(settings, { key: "Escape" }));
    expect(settings).toHaveAttribute("data-open", "false");
    await waitFor(() => expect(settingsButton).toHaveFocus());
  });

  it("keeps a pointer-open settings root available for its enlarged-view action after submenu Escape", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    revealPlayerControls(playerRoot);

    fireEvent.click(screen.getByRole("button", { name: "Open video settings" }));
    const settings = screen.getByRole("group", { name: "Video settings" });
    const settingsButton = screen.getByRole("button", { name: "Open video settings" });
    const speedRoot = within(settings).getByRole("button", { name: "Playback speed — 1×" });
    settingsButton.focus();
    fireEvent.pointerDown(speedRoot, { pointerType: "mouse" });
    speedRoot.focus();
    fireEvent.click(speedRoot);
    const selectedSpeed = within(settings).getByRole("button", { name: "1×" });
    await waitFor(() => expect(selectedSpeed).toHaveFocus());

    await act(async () => fireEvent.keyDown(selectedSpeed, { key: "Escape" }));
    await waitFor(() => expect(speedRoot).toHaveFocus());
    fireEvent.pointerMove(playerRoot, { pointerType: "mouse" });
    expect(settings).toHaveAttribute("data-open", "true");
    fireEvent.click(within(settings).getByRole("button", { name: "Open enlarged player" }));

    const dialog = await screen.findByRole("dialog", { name: "Example Research supplementary workflow video" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close video for Example Research" }));
  });

  it("keeps the outgoing timeline when an enlarged player is closed before its metadata arrives", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const inlinePlayer = getInlineVideo(container);
    const inlineRoot = getInlinePlayer(container);
    revealPlayerControls(inlineRoot);
    setMediaTimeline(inlinePlayer, 21.5);

    fireEvent.click(screen.getByRole("button", { name: "Open video settings" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Video settings" })).getByRole("button", { name: "Open enlarged player" }));
    const dialog = await screen.findByRole("dialog", { name: "Example Research supplementary workflow video" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close video for Example Research" }));
    fireEvent.loadedMetadata(inlinePlayer);

    expect(inlinePlayer.currentTime).toBe(21.5);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("announces rejected playback and completed playback without removing the fallback link", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("blocked"));
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const player = getInlineVideo(container);

    fireEvent.click(screen.getAllByRole("button", { name: "Play video" })[0]!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Video playback is unavailable"));
    expect(screen.getByTestId("read-transcript")).toBeInTheDocument();

    fireEvent.play(player);
    fireEvent.waiting(player);
    expect(screen.getByRole("status")).toHaveTextContent("Video is buffering");
    fireEvent.ended(player);
    expect(screen.getByRole("status")).toHaveTextContent("Video ended");
  });

  it("does not announce an expected aborted play request as a media failure", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException("interrupted", "AbortError"));
    render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Play video" })[0]!);
    await Promise.resolve();
    expect(screen.queryByText("Video playback is unavailable. Read the transcript for the narrated workflow.")).not.toBeInTheDocument();
  });
});
