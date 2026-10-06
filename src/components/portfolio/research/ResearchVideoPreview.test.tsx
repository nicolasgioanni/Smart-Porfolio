import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchVideoPreview } from "@/components/portfolio/research/ResearchVideoPreview";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
const nativeDialogPrototype = HTMLDialogElement.prototype;
const nativeShowModalDescriptor = Object.getOwnPropertyDescriptor(nativeDialogPrototype, "showModal");
const nativeCloseDescriptor = Object.getOwnPropertyDescriptor(nativeDialogPrototype, "close");
const dialogStylesTestId = "modal-dialog-test-styles";

vi.mock("@/components/motion/useReducedMotionPreference", () => ({
  useReducedMotionPreference: () => motionPreference.reduced
}));

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
    Object.defineProperty(nativeDialogPrototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        if (this.open) throw new DOMException("The dialog is already open.", "InvalidStateError");
        this.setAttribute("open", "");
      }
    });
    Object.defineProperty(nativeDialogPrototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      }
    });
    const dialogStyles = document.createElement("style");
    dialogStyles.id = dialogStylesTestId;
    dialogStyles.textContent = `
      dialog.modal-dialog--in-place:not([open]) { display: contents; }
      .modal-dialog--in-place[data-state="inactive"] .modal-dialog__frame { opacity: 1; pointer-events: auto; transform: none; }
    `;
    document.head.append(dialogStyles);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    motionPreference.reduced = false;
    document.body.style.overflow = originalBodyOverflow;
    if (nativeShowModalDescriptor) Object.defineProperty(nativeDialogPrototype, "showModal", nativeShowModalDescriptor);
    else Reflect.deleteProperty(nativeDialogPrototype, "showModal");
    if (nativeCloseDescriptor) Object.defineProperty(nativeDialogPrototype, "close", nativeCloseDescriptor);
    else Reflect.deleteProperty(nativeDialogPrototype, "close");
    document.getElementById(dialogStylesTestId)?.remove();
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

  it("uses one inline player for missing and rejected native fullscreen requests", async () => {
    vi.useFakeTimers();
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const player = getInlineVideo(container);
    const playerRoot = getInlinePlayer(container);
    const fullscreenDialog = container.querySelector<HTMLDialogElement>("[data-testid='research-video-fullscreen']")!;

    setMediaTimeline(player, 42.5);
    player.volume = 0.35;
    player.playbackRate = 1.5;
    revealPlayerControls(playerRoot);
    const fullscreenButton = screen.getByRole("button", { name: "Enter fullscreen" });
    fireEvent.click(screen.getByRole("button", { name: "Open video settings" }));

    expect(fullscreenDialog).toHaveAttribute("role", "presentation");
    expect(fullscreenDialog).not.toHaveAttribute("aria-label");
    expect(fullscreenDialog).not.toHaveAttribute("aria-modal");
    expect(fullscreenDialog).not.toHaveAttribute("tabindex");
    expect(fullscreenDialog).not.toHaveAttribute("open");
    expect(fullscreenDialog).toContainElement(player);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    Object.defineProperty(playerRoot, "requestFullscreen", { configurable: true, value: undefined });
    fireEvent.click(fullscreenButton);
    act(() => vi.advanceTimersByTime(0));

    const firstFallbackDialog = screen.getByRole("dialog", { name: "Example Research supplementary workflow video fullscreen" });
    expect(firstFallbackDialog).toBe(fullscreenDialog);
    expect(firstFallbackDialog).toContainElement(player);
    expect(player.currentTime).toBe(42.5);
    expect(player.volume).toBe(0.35);
    expect(player.playbackRate).toBe(1.5);
    expect(within(firstFallbackDialog).getByTestId("video-settings")).toHaveAttribute("data-open", "false");

    fireEvent.click(within(firstFallbackDialog).getAllByRole("button", { name: "Exit fullscreen" })[1]!);
    act(() => vi.advanceTimersByTime(180));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fullscreenButton).toHaveFocus();
    expect(fullscreenDialog).toContainElement(player);

    Object.defineProperty(playerRoot, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException("Fullscreen denied.", "NotAllowedError"))
    });
    fireEvent.click(fullscreenButton);
    await act(async () => await Promise.resolve());
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("dialog", { name: "Example Research supplementary workflow video fullscreen" })).toContainElement(player);
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => vi.advanceTimersByTime(180));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fullscreenButton).toHaveFocus();
  });

  it("keeps the inline player usable and politely reports a native fallback opening failure", () => {
    vi.useFakeTimers();
    Object.defineProperty(nativeDialogPrototype, "showModal", {
      configurable: true,
      value() {
        throw new DOMException("Native dialog unavailable.", "InvalidStateError");
      }
    });
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const player = getInlineVideo(container);
    const playerRoot = getInlinePlayer(container);
    revealPlayerControls(playerRoot);

    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    act(() => vi.advanceTimersByTime(0));

    const fullscreenDialog = container.querySelector<HTMLDialogElement>("[data-testid='research-video-fullscreen']")!;
    expect(fullscreenDialog).not.toHaveAttribute("open");
    expect(fullscreenDialog).toHaveAttribute("role", "presentation");
    expect(fullscreenDialog).toContainElement(player);
    expect(player).toBe(getInlineVideo(container));
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("Fullscreen is unavailable in this browser.");
  });

  it("retains native fullscreen when document exit is rejected instead of opening the fallback", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    revealPlayerControls(playerRoot);
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: playerRoot });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException("Exit denied.", "NotAllowedError"))
    });

    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    await act(async () => await Promise.resolve());

    expect(document.fullscreenElement).toBe(playerRoot);
    expect(screen.queryByRole("dialog", { name: "Example Research supplementary workflow video fullscreen" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Fullscreen could not be exited. Try again.");
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  });

  it("exposes persistent fullscreen exits only while the native fallback is active", () => {
    vi.useFakeTimers();
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    const fullscreenDialog = container.querySelector<HTMLDialogElement>("[data-testid='research-video-fullscreen']")!;
    const persistentExit = fullscreenDialog.querySelector<HTMLButtonElement>(".research-video-fullscreen__exit")!;

    expect(persistentExit).toHaveAttribute("hidden");
    expect(screen.queryAllByRole("button", { name: "Exit fullscreen" })).toHaveLength(0);

    revealPlayerControls(playerRoot);
    const fullscreenButton = screen.getByRole("button", { name: "Enter fullscreen" });
    Object.defineProperty(playerRoot, "requestFullscreen", { configurable: true, value: undefined });
    fireEvent.click(fullscreenButton);
    act(() => vi.advanceTimersByTime(0));

    const activeDialog = screen.getByRole("dialog", { name: "Example Research supplementary workflow video fullscreen" });
    expect(persistentExit).not.toHaveAttribute("hidden");
    expect(within(activeDialog).getAllByRole("button", { name: "Exit fullscreen" })).toHaveLength(2);
    expect(persistentExit).toHaveFocus();

    fireEvent.click(persistentExit);
    act(() => vi.advanceTimersByTime(180));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(persistentExit).toHaveAttribute("hidden");
    expect(screen.queryAllByRole("button", { name: "Exit fullscreen" })).toHaveLength(0);
    expect(fullscreenButton).toHaveFocus();
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
    fireEvent.click(within(settings).getByRole("button", { name: "Playback speed: 1x" }));
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

  it("retains an enhanced caption during its 180ms exit and cancels the exit when captions return", async () => {
    const captionTrack = new EventTarget() as EventTarget & { activeCues: Array<{ text: string }>; mode: TextTrackMode };
    captionTrack.activeCues = [{ text: "Caption cue remains while it fades." }];
    captionTrack.mode = "showing";
    vi.spyOn(HTMLMediaElement.prototype, "textTracks", "get").mockReturnValue([captionTrack] as unknown as TextTrackList);

    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = screen.getByTestId("research-video-player");
    const player = getInlineVideo(container);
    await waitFor(() => expect(screen.getByTestId("research-video-captions")).toHaveTextContent("Caption cue remains while it fades."));
    revealPlayerControls(playerRoot);

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Disable captions" }));
    expect(playerRoot).toHaveAttribute("data-caption-exiting", "true");
    expect(screen.getByTestId("research-video-captions")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(179));
    expect(screen.getByTestId("research-video-captions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enable captions" }));
    expect(playerRoot).toHaveAttribute("data-caption-exiting", "false");
    expect(playerRoot).toHaveAttribute("data-caption-visible", "true");
    act(() => vi.advanceTimersByTime(180));
    expect(screen.getByTestId("research-video-captions")).toHaveTextContent("Caption cue remains while it fades.");

    fireEvent.click(screen.getByRole("button", { name: "Disable captions" }));
    act(() => vi.advanceTimersByTime(180));
    expect(playerRoot).toHaveAttribute("data-caption-visible", "false");
    expect(screen.getByTestId("research-video-captions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enable captions" }));
    expect(screen.getByTestId("research-video-captions")).toBeInTheDocument();
    fireEvent(player, new Event("enterpictureinpicture"));
    expect(screen.queryByTestId("research-video-captions")).not.toBeInTheDocument();
  });

  it("keeps native captions active until both picture-in-picture and native fullscreen exit", async () => {
    const captionTrack = new EventTarget() as EventTarget & { activeCues: Array<{ text: string }>; mode: TextTrackMode };
    captionTrack.activeCues = [{ text: "External presentation caption." }];
    captionTrack.mode = "showing";
    vi.spyOn(HTMLMediaElement.prototype, "textTracks", "get").mockReturnValue([captionTrack] as unknown as TextTrackList);

    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = getInlinePlayer(container);
    const player = getInlineVideo(container);
    await waitFor(() => expect(screen.getByTestId("research-video-captions")).toHaveTextContent("External presentation caption."));
    expect(captionTrack.mode).toBe("hidden");

    fireEvent(player, new Event("enterpictureinpicture"));
    fireEvent(player, new Event("webkitbeginfullscreen"));
    await waitFor(() => expect(captionTrack.mode).toBe("showing"));
    expect(screen.queryByTestId("research-video-captions")).not.toBeInTheDocument();

    fireEvent(player, new Event("leavepictureinpicture"));
    expect(captionTrack.mode).toBe("showing");

    revealPlayerControls(playerRoot);
    fireEvent.click(screen.getByRole("button", { name: "Disable captions" }));
    expect(captionTrack.mode).toBe("disabled");

    fireEvent(player, new Event("webkitendfullscreen"));
    expect(captionTrack.mode).toBe("disabled");
    expect(screen.queryByTestId("research-video-captions")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enable captions" }));
    await waitFor(() => expect(captionTrack.mode).toBe("hidden"));
    expect(screen.getByTestId("research-video-captions")).toHaveTextContent("External presentation caption.");
  });

  it("keeps retained layers hidden when captions return in a gap after seeking", async () => {
    const captionTrack = new EventTarget() as EventTarget & { activeCues: Array<{ text: string }>; mode: TextTrackMode };
    captionTrack.activeCues = [{ text: "Previous cue must not return after a gap." }];
    captionTrack.mode = "showing";
    vi.spyOn(HTMLMediaElement.prototype, "textTracks", "get").mockReturnValue([captionTrack] as unknown as TextTrackList);

    render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = screen.getByTestId("research-video-player");
    await waitFor(() => expect(screen.getByTestId("research-video-captions")).toHaveTextContent("Previous cue must not return after a gap."));
    revealPlayerControls(playerRoot);

    fireEvent.click(screen.getByRole("button", { name: "Disable captions" }));
    captionTrack.activeCues = [];
    act(() => captionTrack.dispatchEvent(new Event("cuechange")));
    fireEvent.click(screen.getByRole("button", { name: "Enable captions" }));

    expect(playerRoot).toHaveAttribute("data-caption-visible", "false");
    expect(playerRoot).toHaveAttribute("data-caption-exiting", "false");
    expect(screen.getByTestId("research-video-captions")).toHaveAttribute("aria-hidden", "true");
  });

  it("removes enhanced captions immediately when reduced motion is preferred", async () => {
    motionPreference.reduced = true;
    const captionTrack = new EventTarget() as EventTarget & { activeCues: Array<{ text: string }>; mode: TextTrackMode };
    captionTrack.activeCues = [{ text: "Reduced motion caption." }];
    captionTrack.mode = "showing";
    vi.spyOn(HTMLMediaElement.prototype, "textTracks", "get").mockReturnValue([captionTrack] as unknown as TextTrackList);

    render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const playerRoot = screen.getByTestId("research-video-player");
    await waitFor(() => expect(screen.getByTestId("research-video-captions")).toHaveTextContent("Reduced motion caption."));
    revealPlayerControls(playerRoot);

    fireEvent.click(screen.getByRole("button", { name: "Disable captions" }));
    expect(playerRoot).toHaveAttribute("data-caption-exiting", "false");
    expect(playerRoot).toHaveAttribute("data-caption-visible", "false");
    expect(screen.getByTestId("research-video-captions")).toBeInTheDocument();
  });

  it("announces a non-preset rate while keeping its nearest slider position through the enlarged-player handoff", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const inlinePlayer = getInlineVideo(container);
    const inlineRoot = getInlinePlayer(container);
    revealPlayerControls(inlineRoot);
    const settingsButton = screen.getByRole("button", { name: "Open video settings" });
    setMediaTimeline(inlinePlayer, 12.5);
    inlinePlayer.volume = 0.4;
    inlinePlayer.muted = true;
    inlinePlayer.playbackRate = 1.75;
    fireEvent.rateChange(inlinePlayer);
    const pauseInline = vi.spyOn(inlinePlayer, "pause");

    fireEvent.click(screen.getByRole("button", { name: "Disable captions" }));
    fireEvent.click(settingsButton);
    const inlineSettings = screen.getByRole("group", { name: "Video settings" });
    const inlineSpeedRow = within(inlineSettings).getByRole("button", { name: "Playback speed: 1.75x" });
    fireEvent.click(inlineSpeedRow);
    const inlineSpeedRange = within(inlineSettings).getByRole("slider", { name: "Playback speed" });
    expect(inlineSpeedRange).toHaveValue("4");
    expect(inlineSpeedRange).toHaveAttribute("aria-valuetext", "1.75x");
    expect(within(inlineSettings).getByText("1.75x")).toBeInTheDocument();
    await act(async () => fireEvent.keyDown(inlineSpeedRange, { key: "Escape" }));
    await waitFor(() => expect(inlineSpeedRow).toHaveFocus());
    fireEvent.click(within(inlineSettings).getByRole("button", { name: "Open enlarged player" }));
    const dialog = await screen.findByRole("dialog", { name: "Example Research supplementary workflow video" });
    const modalPlayer = dialog.querySelector<HTMLVideoElement>(".research-video-player__media")!;
    fireEvent.loadedMetadata(modalPlayer);
    const modalRoot = within(dialog).getByTestId("research-video-player");
    revealPlayerControls(modalRoot);

    expect(pauseInline).toHaveBeenCalled();
    expect(modalPlayer.currentTime).toBe(12.5);
    expect(modalPlayer.volume).toBe(0.4);
    expect(modalPlayer.muted).toBe(true);
    expect(modalPlayer.playbackRate).toBe(1.75);
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

  it("uses a native indexed playback-speed range and returns to settings before the dialog lifecycle", async () => {
    const { container } = render(<ResearchVideoPreview poster={graphicalAbstract} title="Example Research" video={video} />);
    const player = getInlineVideo(container);
    const playerRoot = getInlinePlayer(container);
    revealPlayerControls(playerRoot);
    setMediaTimeline(player);
    const settingsButton = screen.getByRole("button", { name: "Open video settings" });

    fireEvent.click(settingsButton);
    const settings = screen.getByRole("group", { name: "Video settings" });
    const speedMenu = within(settings).getByRole("button", { name: "Playback speed: 1x" });
    speedMenu.focus();
    fireEvent.keyDown(speedMenu, { key: "Enter" });
    fireEvent.click(speedMenu);
    expect(settings).toHaveAttribute("data-view", "speeds");
    expect(within(settings).getByRole("button", { name: "Back to video settings" })).toBeInTheDocument();
    const speedRange = within(settings).getByRole("slider", { name: "Playback speed" });
    expect(speedRange).toHaveAttribute("min", "0");
    expect(speedRange).toHaveAttribute("max", "5");
    expect(speedRange).toHaveAttribute("step", "1");
    expect(speedRange).toHaveAttribute("aria-valuetext", "1x");
    await waitFor(() => expect(speedRange).toHaveFocus());
    await act(async () => fireEvent.keyDown(speedRange, { key: "Escape" }));
    expect(settings).toHaveAttribute("data-view", "root");
    await waitFor(() => expect(speedMenu).toHaveFocus());

    fireEvent.click(speedMenu);
    const updatedSpeedRange = within(settings).getByRole("slider", { name: "Playback speed" });
    for (const [index, rate] of [0.5, 0.75, 1, 1.25, 1.5, 2].entries()) {
      fireEvent.change(updatedSpeedRange, { target: { value: String(index) } });
      expect(player.playbackRate).toBe(rate);
      expect(updatedSpeedRange).toHaveAttribute("aria-valuetext", `${rate}x`);
      expect(settings).toHaveAttribute("data-open", "true");
      expect(settings).toHaveAttribute("data-view", "speeds");
    }

    await act(async () => fireEvent.keyDown(updatedSpeedRange, { key: "Escape" }));
    expect(settings).toHaveAttribute("data-view", "root");
    await waitFor(() => expect(screen.getByRole("button", { name: "Playback speed: 2x" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Playback speed: 2x" }));
    const back = within(settings).getByRole("button", { name: "Back to video settings" });
    fireEvent.click(back);
    expect(settings).toHaveAttribute("data-view", "root");
    await waitFor(() => expect(screen.getByRole("button", { name: "Playback speed: 2x" })).toHaveFocus());

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
    const speedRoot = within(settings).getByRole("button", { name: "Playback speed: 1x" });
    settingsButton.focus();
    fireEvent.pointerDown(speedRoot, { pointerType: "mouse" });
    speedRoot.focus();
    fireEvent.click(speedRoot);
    const speedRange = within(settings).getByRole("slider", { name: "Playback speed" });
    await waitFor(() => expect(speedRange).toHaveFocus());

    await act(async () => fireEvent.keyDown(speedRange, { key: "Escape" }));
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
