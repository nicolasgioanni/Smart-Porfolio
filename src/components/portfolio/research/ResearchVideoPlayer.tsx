"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type ReactNode,
  type Ref,
  type RefObject
} from "react";
import { LinkIcon } from "@/components/icons/LinkIcon";
import type { ResearchGraphicalAbstract } from "@/lib/content/researchGraphicalAbstracts";
import type { ResearchVideo } from "@/lib/content/researchVideos";
import {
  applyPlaybackSettings,
  setPlaybackTime,
  type ResearchVideoPlaybackSettings
} from "@/lib/media/researchVideoPlayback";

type VideoStatus = "buffering" | "ended" | "error" | "loading" | "ready";
type SettingsView = "root" | "speeds";

type ResearchVideoPlayerProps = {
  captionsEnabled: boolean;
  className?: string;
  expandButtonRef?: RefObject<HTMLButtonElement | null>;
  keepControlsVisible?: boolean;
  label: string;
  onCaptionsEnabledChange: (enabled: boolean) => void;
  onPlay?: () => void;
  onVideoElementAvailable?: (videoElement: HTMLVideoElement | null) => void;
  onRequestExpand?: () => void;
  playbackSettings?: ResearchVideoPlaybackSettings;
  playbackTransferKey?: number;
  poster: ResearchGraphicalAbstract;
  showExpandControl?: boolean;
  video: ResearchVideo;
  videoRef: RefObject<HTMLVideoElement | null>;
};

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const soundPopoverDismissDelayMs = 160;
const settingsTransitionPaddingPx = 12;
const pointerControlsIdleDelayMs = 4_000;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const remainderSeconds = wholeSeconds % 60;
  const minuteText = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${minuteText}:${String(remainderSeconds).padStart(2, "0")}`;
}

function getActiveCueText(track: TextTrack | undefined): string {
  if (!track?.activeCues) return "";

  return Array.from(track.activeCues)
    .map((cue) => ("text" in cue ? String(cue.text) : "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

function setTrackMode(track: TextTrack | undefined, enabled: boolean, enhanced: boolean, inPictureInPicture: boolean) {
  if (!track) return;
  track.mode = enabled ? (enhanced && !inPictureInPicture ? "hidden" : "showing") : "disabled";
}

function statusMessage(status: VideoStatus): string | null {
  if (status === "loading") return "Loading video metadata.";
  if (status === "buffering") return "Video is buffering.";
  if (status === "ended") return "Video ended. Use Play video to replay it.";
  if (status === "error") return "Video playback is unavailable. Read the transcript for the narrated workflow.";
  return null;
}

function VideoButton({
  ariaControls,
  ariaExpanded,
  buttonRef,
  children,
  className,
  label,
  onClick,
  pressed,
  title
}: {
  ariaControls?: string;
  ariaExpanded?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  title?: string;
}) {
  return (
    <button
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      aria-label={label}
      aria-pressed={pressed}
      className={["research-video-player__control", className].filter(Boolean).join(" ")}
      onClick={onClick}
      ref={buttonRef}
      title={title ?? label}
      type="button"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

/**
 * A progressively enhanced, self-hosted player. The server output keeps the
 * browser media controls and enabled caption track; this control layer only
 * replaces them after hydration succeeds.
 */
export function ResearchVideoPlayer({
  captionsEnabled,
  className,
  expandButtonRef,
  keepControlsVisible = false,
  label,
  onCaptionsEnabledChange,
  onPlay,
  onVideoElementAvailable,
  onRequestExpand,
  playbackSettings,
  playbackTransferKey = 0,
  poster,
  showExpandControl = false,
  video,
  videoRef
}: ResearchVideoPlayerProps) {
  const [enhanced, setEnhanced] = useState(false);
  const [status, setStatus] = useState<VideoStatus>("loading");
  const [paused, setPaused] = useState(true);
  const [ended, setEnded] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number.NaN);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPinned, setSettingsPinned] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>("root");
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumePinned, setVolumePinned] = useState(false);
  const [volumeOpenedByTouch, setVolumeOpenedByTouch] = useState(false);
  const [volumeDragging, setVolumeDragging] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [pointerControlsActive, setPointerControlsActive] = useState(false);
  const [keyboardFocusWithin, setKeyboardFocusWithin] = useState(false);
  const [touchControlsLatched, setTouchControlsLatched] = useState(false);
  const [activeCueText, setActiveCueText] = useState("");
  const [inPictureInPicture, setInPictureInPicture] = useState(false);
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [capabilityMessage, setCapabilityMessage] = useState("");
  const [videoElement, setVideoElementState] = useState<HTMLVideoElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const speedMenuButtonRef = useRef<HTMLButtonElement>(null);
  const speedOptionsRef = useRef<HTMLDivElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const soundButtonRef = useRef<HTMLButtonElement>(null);
  const volumeRangeRef = useRef<HTMLDivElement>(null);
  const restoreSettingsFocusRef = useRef(false);
  const restoreSpeedMenuFocusRef = useRef(false);
  const focusSpeedMenuRef = useRef(false);
  const suppressSettingsFocusRef = useRef(false);
  const programmaticPointerSettingsFocusRef = useRef(false);
  const settingsPointerIntentRef = useRef(false);
  const suppressSoundFocusRef = useRef(false);
  const lastAudibleVolumeRef = useRef(1);
  const volumeDraggingRef = useRef(false);
  const soundDismissTimerRef = useRef<number | undefined>(undefined);
  const soundDismissTimerGenerationRef = useRef(0);
  const pointerControlsIdleTimerRef = useRef<number | undefined>(undefined);
  const pointerInsideRef = useRef(false);
  const interactionRef = useRef<"keyboard" | "pointer" | "touch">("pointer");
  const pendingPlaybackTimeRef = useRef<number | null>(null);
  const settingsId = `research-video-settings-${useId().replaceAll(":", "")}`;
  const soundId = `research-video-sound-${useId().replaceAll(":", "")}`;

  const clearSoundDismissTimer = useCallback(() => {
    soundDismissTimerGenerationRef.current += 1;
    if (soundDismissTimerRef.current !== undefined) window.clearTimeout(soundDismissTimerRef.current);
    soundDismissTimerRef.current = undefined;
  }, []);

  const clearPointerControlsIdleTimer = useCallback(() => {
    if (pointerControlsIdleTimerRef.current !== undefined) window.clearTimeout(pointerControlsIdleTimerRef.current);
    pointerControlsIdleTimerRef.current = undefined;
  }, []);

  const resetPointerControlsIdleTimer = useCallback(() => {
    clearPointerControlsIdleTimer();
    setPointerControlsActive(true);
    pointerControlsIdleTimerRef.current = window.setTimeout(() => {
      pointerControlsIdleTimerRef.current = undefined;
      if (pointerInsideRef.current) setPointerControlsActive(false);
    }, pointerControlsIdleDelayMs);
  }, [clearPointerControlsIdleTimer]);

  const showControls = useCallback(() => setControlsVisible(true), []);

  const setSettingsButton = useCallback(
    (button: HTMLButtonElement | null) => {
      settingsButtonRef.current = button;
      if (expandButtonRef) expandButtonRef.current = button;
    },
    [expandButtonRef]
  );

  const applyPendingPlaybackTime = useCallback(() => {
    const pendingPlaybackTime = pendingPlaybackTimeRef.current;
    if (pendingPlaybackTime === null) return;
    if (setPlaybackTime(videoElementRef.current, pendingPlaybackTime)) {
      setCurrentTime(pendingPlaybackTime);
      pendingPlaybackTimeRef.current = null;
    }
  }, []);

  const setVideoElement = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      videoElementRef.current = videoElement;
      videoRef.current = videoElement;
      setVideoElementState(videoElement);
      onVideoElementAvailable?.(videoElement);

      if (!videoElement) return;
      setPaused(videoElement.paused);
      setCurrentTime(Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : 0);
      setDuration(videoElement.duration);
      setMuted(videoElement.muted);
      setVolume(videoElement.volume);
      setPlaybackRate(videoElement.playbackRate);
      if (videoElement.volume > 0) lastAudibleVolumeRef.current = videoElement.volume;
    },
    [onVideoElementAvailable, videoRef]
  );

  useEffect(() => {
    setEnhanced(true);
    setPictureInPictureSupported(Boolean(document.pictureInPictureEnabled && document.pictureInPictureElement !== undefined));
    setFullscreenSupported(Boolean(document.fullscreenEnabled || "requestFullscreen" in HTMLElement.prototype));
  }, []);

  useLayoutEffect(() => {
    if (settingsOpen || !restoreSettingsFocusRef.current) return;
    restoreSettingsFocusRef.current = false;
    settingsButtonRef.current?.focus();
  }, [settingsOpen]);

  useLayoutEffect(() => {
    if (settingsView !== "root" || !restoreSpeedMenuFocusRef.current) return;
    restoreSpeedMenuFocusRef.current = false;
    if (programmaticPointerSettingsFocusRef.current) suppressSettingsFocusRef.current = true;
    speedMenuButtonRef.current?.focus();
  }, [settingsView]);

  useLayoutEffect(() => {
    if (settingsView !== "speeds" || !focusSpeedMenuRef.current) return;
    focusSpeedMenuRef.current = false;
    const selectedRate = speedOptionsRef.current?.querySelector<HTMLButtonElement>("button[aria-pressed='true']");
    if (!selectedRate) return;
    suppressSettingsFocusRef.current = true;
    selectedRate.focus();
  }, [settingsView]);

  useEffect(() => {
    if (!videoElement || videoElement.readyState < HTMLMediaElement.HAVE_METADATA) return;
    updateTimeline();
    applyPendingPlaybackTime();
    setStatus(videoElement.error ? "error" : "ready");
  }, [applyPendingPlaybackTime, videoElement]);

  useEffect(() => {
    if (videoElement && "webkitEnterFullscreen" in videoElement) setFullscreenSupported(true);
  }, [videoElement]);

  useEffect(
    () => () => {
      clearSoundDismissTimer();
      clearPointerControlsIdleTimer();
    },
    [clearPointerControlsIdleTimer, clearSoundDismissTimer]
  );

  useEffect(() => {
    const retainedByKeyboardOrTouch = keyboardFocusWithin || touchControlsLatched;
    const retainedByControlInteraction = settingsOpen || volumeOpen || volumeDragging;
    const retainedByPlaybackStatus = status === "buffering" || status === "error" || Boolean(capabilityMessage);

    setControlsVisible(
      keepControlsVisible ||
        pointerControlsActive ||
        seeking ||
        retainedByKeyboardOrTouch ||
        retainedByControlInteraction ||
        retainedByPlaybackStatus
    );
  }, [capabilityMessage, keepControlsVisible, keyboardFocusWithin, pointerControlsActive, seeking, settingsOpen, status, touchControlsLatched, volumeDragging, volumeOpen]);

  useEffect(() => {
    if (!playbackSettings) return;

    const player = videoElement;
    if (!player) return;
    pendingPlaybackTimeRef.current = playbackSettings.currentTime;
    applyPlaybackSettings(player, { ...playbackSettings, currentTime: 0 });
    setMuted(playbackSettings.muted);
    setVolume(playbackSettings.volume);
    setPlaybackRate(playbackSettings.playbackRate);
    if (playbackSettings.volume > 0) lastAudibleVolumeRef.current = playbackSettings.volume;
    setCurrentTime(playbackSettings.currentTime);
    if (player.readyState >= HTMLMediaElement.HAVE_METADATA) applyPendingPlaybackTime();
  }, [applyPendingPlaybackTime, playbackSettings, playbackTransferKey, videoElement]);

  useEffect(() => {
    const player = videoElement;
    if (!player) return;
    const captionTrack = player.textTracks[0];
    const updateCues = () => setActiveCueText(getActiveCueText(captionTrack));

    setTrackMode(captionTrack, captionsEnabled, enhanced, inPictureInPicture);
    updateCues();
    captionTrack?.addEventListener("cuechange", updateCues);
    return () => captionTrack?.removeEventListener("cuechange", updateCues);
  }, [captionsEnabled, enhanced, inPictureInPicture, videoElement]);

  useEffect(() => {
    if (!videoElement) return;
    const onPictureInPictureEnter = () => setInPictureInPicture(true);
    const onPictureInPictureLeave = () => setInPictureInPicture(false);
    const onNativeFullscreenEnter = () => setInPictureInPicture(true);
    const onNativeFullscreenLeave = () => setInPictureInPicture(false);

    videoElement.addEventListener("enterpictureinpicture", onPictureInPictureEnter);
    videoElement.addEventListener("leavepictureinpicture", onPictureInPictureLeave);
    videoElement.addEventListener("webkitbeginfullscreen", onNativeFullscreenEnter);
    videoElement.addEventListener("webkitendfullscreen", onNativeFullscreenLeave);
    return () => {
      videoElement.removeEventListener("enterpictureinpicture", onPictureInPictureEnter);
      videoElement.removeEventListener("leavepictureinpicture", onPictureInPictureLeave);
      videoElement.removeEventListener("webkitbeginfullscreen", onNativeFullscreenEnter);
      videoElement.removeEventListener("webkitendfullscreen", onNativeFullscreenLeave);
    };
  }, [videoElement]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === player);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    if (!settingsOpen || !settingsPointerIntentRef.current) return;

    function dismissAfterPointerIntent(event: PointerEvent) {
      if (event.pointerType === "touch" || !settingsPointerIntentRef.current) return;
      const settings = settingsPopoverRef.current;
      if (settings?.contains(event.target as Node)) {
        settingsPointerIntentRef.current = false;
        clearSoundDismissTimer();
        return;
      }

      const settingsTrigger = settingsButtonRef.current;
      const triggerBounds = settingsTrigger?.getBoundingClientRect();
      const settingsBounds = settings?.getBoundingClientRect();
      const withinSettingsTransitionCorridor = Boolean(
        triggerBounds &&
          settingsBounds &&
          event.clientX >= Math.min(triggerBounds.left, settingsBounds.left) - settingsTransitionPaddingPx &&
          event.clientX <= Math.max(triggerBounds.right, settingsBounds.right) + settingsTransitionPaddingPx &&
          event.clientY >= Math.min(triggerBounds.top, settingsBounds.top) - settingsTransitionPaddingPx &&
          event.clientY <= Math.max(triggerBounds.bottom, settingsBounds.bottom) + settingsTransitionPaddingPx
      );

      // The trigger and panel are positioned separately. Keep intent through
      // their shared geometry (and the player itself) so intermediate pointer
      // targets or a layout transition cannot dismiss the panel before a click.
      if (withinSettingsTransitionCorridor || playerRef.current?.contains(event.target as Node)) {
        clearSoundDismissTimer();
        return;
      }

      settingsPointerIntentRef.current = false;
      clearSoundDismissTimer();
      const generation = soundDismissTimerGenerationRef.current;
      soundDismissTimerRef.current = window.setTimeout(() => {
        if (generation !== soundDismissTimerGenerationRef.current) return;
        soundDismissTimerRef.current = undefined;

        const activeElement = document.activeElement;
        const keyboardFocus = Boolean(
          activeElement instanceof HTMLElement &&
            playerRef.current?.contains(activeElement) &&
            !(
              programmaticPointerSettingsFocusRef.current &&
              activeElement.closest(".research-video-player__settings")
            ) &&
            (interactionRef.current === "keyboard" || activeElement.matches(":focus-visible"))
        );
        if (keyboardFocus) {
          setKeyboardFocusWithin(true);
          setSettingsPinned(true);
          return;
        }

        if (settingsPopoverRef.current?.matches(":hover")) return;
        setSettingsOpen(false);
        setSettingsPinned(false);
        setSettingsView("root");
        programmaticPointerSettingsFocusRef.current = false;
      }, soundPopoverDismissDelayMs);
    }

    document.addEventListener("pointermove", dismissAfterPointerIntent, true);
    return () => document.removeEventListener("pointermove", dismissAfterPointerIntent, true);
  }, [clearSoundDismissTimer, settingsOpen]);

  useEffect(() => {
    function dismissFromOutside(event: PointerEvent) {
      const player = playerRef.current;
      if (player?.contains(event.target as Node)) return;

      setTouchControlsLatched(false);
      if (settingsOpen) {
        setSettingsOpen(false);
        setSettingsPinned(false);
        setSettingsView("root");
      }
      if (volumeOpen) {
        clearSoundDismissTimer();
        setVolumeOpen(false);
        setVolumePinned(false);
        setVolumeOpenedByTouch(false);
        volumeDraggingRef.current = false;
        setVolumeDragging(false);
      }
    }

    document.addEventListener("pointerdown", dismissFromOutside, true);
    return () => document.removeEventListener("pointerdown", dismissFromOutside, true);
  }, [clearSoundDismissTimer, settingsOpen, volumeOpen]);

  function updateTimeline() {
    const player = videoElementRef.current;
    if (!player) return;
    setCurrentTime(Number.isFinite(player.currentTime) ? player.currentTime : 0);
    setDuration(player.duration);
  }

  function togglePlayback() {
    const player = videoElementRef.current;
    if (!player) return;

    if (player.paused || player.ended) {
      setStatus("ready");
      setEnded(false);
      const playResult = player.play();
      if (playResult && typeof playResult.catch === "function") {
        void playResult.catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStatus("error");
          setPaused(true);
        });
      }
      return;
    }

    player.pause();
  }

  function hasKeyboardVisibleFocus() {
    const activeElement = document.activeElement;
    const isProgrammaticPointerSettingsFocus = Boolean(
      programmaticPointerSettingsFocusRef.current &&
        activeElement instanceof Element &&
        activeElement.closest(".research-video-player__settings")
    );
    return Boolean(
      activeElement instanceof HTMLElement &&
        playerRef.current?.contains(activeElement) &&
        !isProgrammaticPointerSettingsFocus &&
        (interactionRef.current === "keyboard" || activeElement.matches(":focus-visible"))
    );
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("button, input, a, [role='group']"));
  }

  function closeSettings(restoreFocus = false) {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && settingsPopoverRef.current?.contains(activeElement)) activeElement.blur();
    clearSoundDismissTimer();
    if (restoreFocus) restoreSettingsFocusRef.current = true;
    setSettingsOpen(false);
    setSettingsPinned(false);
    setSettingsView("root");
    programmaticPointerSettingsFocusRef.current = false;
    settingsPointerIntentRef.current = false;
  }

  function closeVolumeRange(restoreFocus = false) {
    clearSoundDismissTimer();
    setVolumeOpen(false);
    setVolumePinned(false);
    setVolumeOpenedByTouch(false);
    volumeDraggingRef.current = false;
    setVolumeDragging(false);
    if (!restoreFocus) return;

    suppressSoundFocusRef.current = true;
    soundButtonRef.current?.focus();
  }

  function openSettings() {
    if (settingsOpen) {
      closeSettings();
      return;
    }

    clearSoundDismissTimer();
    closeVolumeRange();
    programmaticPointerSettingsFocusRef.current = false;
    settingsPointerIntentRef.current = interactionRef.current === "pointer";
    setSettingsPinned(interactionRef.current !== "pointer");
    setSettingsView("root");
    setSettingsOpen(true);
    showControls();
  }

  function openVolumeRange() {
    clearSoundDismissTimer();
    closeSettings();
    setVolumePinned(interactionRef.current !== "pointer");
    setVolumeOpenedByTouch(interactionRef.current === "touch");
    setVolumeOpen(true);
    showControls();
  }

  function schedulePointerVolumeDismissal() {
    if (!volumeOpen || volumePinned || volumeDraggingRef.current || hasKeyboardVisibleFocus()) {
      if (hasKeyboardVisibleFocus()) setVolumePinned(true);
      return;
    }

    schedulePointerPopoverDismissal();
  }

  function schedulePointerPopoverDismissal() {
    clearSoundDismissTimer();
    const generation = soundDismissTimerGenerationRef.current;
    soundDismissTimerRef.current = window.setTimeout(() => {
      if (generation !== soundDismissTimerGenerationRef.current) return;
      soundDismissTimerRef.current = undefined;
      if (hasKeyboardVisibleFocus()) {
        setKeyboardFocusWithin(true);
        if (settingsOpen) setSettingsPinned(true);
        if (volumeOpen) setVolumePinned(true);
        return;
      }

      const settingsHovered = settingsPopoverRef.current?.matches(":hover");
      const soundHovered = soundButtonRef.current?.matches(":hover") || volumeRangeRef.current?.matches(":hover");

      if (settingsOpen && !settingsPinned && !settingsPointerIntentRef.current && !settingsHovered) closeSettings();
      if (volumeOpen && !volumePinned && !volumeDraggingRef.current && !soundHovered) closeVolumeRange();
    }, soundPopoverDismissDelayMs);
  }

  function startVolumeDrag() {
    volumeDraggingRef.current = true;
    setVolumeDragging(true);
    showControls();
  }

  function endVolumeDrag() {
    volumeDraggingRef.current = false;
    setVolumeDragging(false);
  }

  function openSpeedMenu() {
    const keyboardTriggered = hasKeyboardVisibleFocus();
    focusSpeedMenuRef.current = true;
    programmaticPointerSettingsFocusRef.current = interactionRef.current === "pointer" && !keyboardTriggered;
    setSettingsView("speeds");
    setSettingsPinned(interactionRef.current !== "pointer" || keyboardTriggered);
    showControls();
  }

  function closeSpeedMenu(restoreFocus = false) {
    if (restoreFocus) {
      clearSoundDismissTimer();
      restoreSpeedMenuFocusRef.current = true;
      setSettingsPinned(true);
    }
    setSettingsView("root");
  }

  function handlePointerEnter(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    interactionRef.current = "pointer";
    pointerInsideRef.current = true;
    clearSoundDismissTimer();
    resetPointerControlsIdleTimer();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    interactionRef.current = "pointer";
    pointerInsideRef.current = true;
    resetPointerControlsIdleTimer();
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    if (event.relatedTarget instanceof Node && playerRef.current?.contains(event.relatedTarget)) return;
    pointerInsideRef.current = false;
    clearSoundDismissTimer();
    clearPointerControlsIdleTimer();
    setPointerControlsActive(false);

    const keyboardFocus = hasKeyboardVisibleFocus();
    if (
      (settingsOpen && !settingsPinned && !settingsPointerIntentRef.current && !keyboardFocus) ||
      (volumeOpen && !volumePinned && !keyboardFocus)
    ) {
      schedulePointerPopoverDismissal();
    }

    setKeyboardFocusWithin(keyboardFocus);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    interactionRef.current = event.pointerType === "touch" ? "touch" : "pointer";
    setKeyboardFocusWithin(false);
    if (event.pointerType !== "touch") {
      pointerInsideRef.current = true;
      resetPointerControlsIdleTimer();
    }
    if (event.target instanceof Element && event.target.closest(".research-video-player__settings")) {
      settingsPointerIntentRef.current = false;
      clearSoundDismissTimer();
      setSettingsPinned(true);
    }
  }

  function handleTouchSurface(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || isInteractiveTarget(event.target)) return;

    interactionRef.current = "touch";
    if (settingsOpen) closeSettings();
    if (volumeOpen) closeVolumeRange();

    setTouchControlsLatched((latched) => {
      const nextLatched = !latched;
      setControlsVisible(nextLatched);
      return nextLatched;
    });
  }

  function handleFocusCapture(event: React.FocusEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (suppressSettingsFocusRef.current && target.closest(".research-video-player__settings")) {
      suppressSettingsFocusRef.current = false;
      return;
    }
    const restoringExpandedViewFocus = Boolean(
      keepControlsVisible && target instanceof Node && settingsButtonRef.current?.isSameNode(target)
    );
    if (interactionRef.current !== "keyboard" && !target.matches(":focus-visible") && !restoringExpandedViewFocus) return;

    interactionRef.current = "keyboard";
    if (target.closest(".research-video-player__settings")) setSettingsPinned(true);
    if (target.closest(".research-video-player__sound")) setVolumePinned(true);
    setKeyboardFocusWithin(true);
    showControls();
  }

  function handleBlurCapture(event: ReactFocusEvent<HTMLDivElement>) {
    // Browsers run blur before the new target receives focus. Retain its
    // related target so a pointer press inside an open panel cannot make the
    // panel inert before the subsequent click is dispatched.
    const nextFocusTarget = event.relatedTarget;
    queueMicrotask(() => {
      const activeElement = document.activeElement;
      const isWithinSound = (element: EventTarget | null) =>
        element instanceof Element && Boolean(element.closest(".research-video-player__sound"));
      const isWithinSettings = (element: EventTarget | null) =>
        element instanceof Element && Boolean(element.closest(".research-video-player__settings"));
      const focusWithinSound = isWithinSound(activeElement) || isWithinSound(nextFocusTarget);
      const focusWithinSettings = isWithinSettings(activeElement) || isWithinSettings(nextFocusTarget);
      const keyboardFocus = hasKeyboardVisibleFocus();
      setKeyboardFocusWithin(keyboardFocus);
      if (volumeOpen && volumePinned && !volumeOpenedByTouch && !volumeDraggingRef.current && !focusWithinSound) closeVolumeRange();
      if (keyboardFocus) return;

      if (settingsOpen && settingsPinned && !focusWithinSettings) closeSettings();
    });
  }

  function changeTime(nextTime: number) {
    const player = videoElementRef.current;
    if (!player || !Number.isFinite(nextTime)) return;
    setPlaybackTime(player, nextTime);
    setCurrentTime(nextTime);
    setEnded(false);
    setStatus("ready");
  }

  function toggleMute() {
    const player = videoElementRef.current;
    if (!player) return;
    const unmuting = player.muted || player.volume === 0;
    if (unmuting) {
      const nextVolume = player.volume > 0 ? player.volume : lastAudibleVolumeRef.current || 1;
      player.volume = nextVolume;
      player.muted = false;
      setVolume(nextVolume);
      setMuted(false);
    } else {
      if (player.volume > 0) lastAudibleVolumeRef.current = player.volume;
      player.muted = true;
      setMuted(true);
    }
  }

  function changeVolume(nextVolume: number) {
    const player = videoElementRef.current;
    if (!player) return;
    const safeVolume = Math.max(0, Math.min(1, nextVolume));
    if (safeVolume > 0) lastAudibleVolumeRef.current = safeVolume;
    player.volume = safeVolume;
    player.muted = safeVolume === 0;
    setVolume(safeVolume);
    setMuted(safeVolume === 0);
  }

  function changePlaybackRate(nextRate: number) {
    const player = videoElementRef.current;
    if (!player) return;
    player.playbackRate = nextRate;
    setPlaybackRate(nextRate);
    closeSpeedMenu(true);
  }

  async function togglePictureInPicture() {
    const player = videoElementRef.current;
    if (!player || !pictureInPictureSupported) return;
    closeSettings(true);

    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await player.requestPictureInPicture();
    } catch {
      setCapabilityMessage("Picture in picture is unavailable in this browser.");
    }
  }

  function requestExpandedPlayer() {
    closeSettings();
    onRequestExpand?.();
  }

  async function toggleFullscreen() {
    const player = playerRef.current;
    const videoElement = videoElementRef.current;
    if (!player) return;

    try {
      if (document.fullscreenElement === player) {
        await document.exitFullscreen?.();
      } else if (player.requestFullscreen) {
        await player.requestFullscreen();
      } else if (videoElement && "webkitEnterFullscreen" in videoElement) {
        (videoElement as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
      } else {
        onRequestExpand?.();
      }
    } catch {
      setCapabilityMessage("Fullscreen is unavailable in this browser.");
    }
  }

  function handleEscape(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;

    if (volumeOpen) {
      event.preventDefault();
      closeVolumeRange(true);
      return;
    }

    if (settingsOpen && settingsView === "speeds") {
      event.preventDefault();
      closeSpeedMenu(true);
      return;
    }

    if (settingsOpen) {
      event.preventDefault();
      closeSettings(true);
      return;
    }

    if (fullscreen || document.fullscreenElement === playerRef.current) {
      event.preventDefault();
      void document.exitFullscreen?.();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    programmaticPointerSettingsFocusRef.current = false;
    interactionRef.current = "keyboard";
    setKeyboardFocusWithin(true);
    showControls();
    handleEscape(event);
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const visibleCaption = enhanced && captionsEnabled && !inPictureInPicture ? activeCueText : "";
  const message = statusMessage(status);

  return (
    <div
      aria-label={label}
      className={["research-video-player", className].filter(Boolean).join(" ")}
      data-controls-visible={controlsVisible ? "true" : "false"}
      data-enhanced={enhanced ? "true" : "false"}
      data-settings-open={settingsOpen ? "true" : "false"}
      data-testid="research-video-player"
      data-volume-open={volumeOpen ? "true" : "false"}
      onBlurCapture={handleBlurCapture}
      onFocusCapture={handleFocusCapture}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handleTouchSurface}
      ref={playerRef}
      tabIndex={-1}
    >
      <video
        aria-label={label}
        className="research-video-player__media"
        controls={!enhanced}
        height={video.height}
        onDurationChange={updateTimeline}
        onEnded={() => {
          setEnded(true);
          setPaused(true);
          setStatus("ended");
        }}
        onError={() => {
          setStatus("error");
          setPaused(true);
        }}
        onLoadedData={() => setStatus("ready")}
        onLoadedMetadata={() => {
          updateTimeline();
          applyPendingPlaybackTime();
          setStatus("ready");
        }}
        onLoadStart={() => setStatus("loading")}
        onPause={() => {
          setPaused(true);
        }}
        onPlay={() => {
          setPaused(false);
          setEnded(false);
          setStatus("ready");
          onPlay?.();
        }}
        onPlaying={() => setStatus("ready")}
        onRateChange={() => {
          const player = videoElementRef.current;
          if (player) setPlaybackRate(player.playbackRate);
        }}
        onSeeked={() => {
          setSeeking(false);
          updateTimeline();
        }}
        onSeeking={() => {
          setSeeking(true);
          showControls();
        }}
        onStalled={() => {
          setStatus("buffering");
        }}
        onTimeUpdate={updateTimeline}
        onWaiting={() => {
          setStatus("buffering");
        }}
        onVolumeChange={() => {
          const player = videoElementRef.current;
          if (!player) return;
          setMuted(player.muted);
          setVolume(player.volume);
          if (player.volume > 0) lastAudibleVolumeRef.current = player.volume;
        }}
        playsInline
        poster={poster.src}
        preload="metadata"
        ref={setVideoElement}
        width={video.width}
      >
        <source src={video.src} type={video.mimeType} />
        <track default kind="captions" label="English" src={video.captionsSrc} srcLang="en" />
        Your browser cannot play this video. Read the transcript below.
      </video>

      {visibleCaption ? (
        <>
          <p aria-hidden="true" className="research-video-player__captions research-video-player__captions--lower">
            {visibleCaption}
          </p>
          <p aria-hidden="true" className="research-video-player__captions research-video-player__captions--raised" data-testid="research-video-captions">
            {visibleCaption}
          </p>
        </>
      ) : null}

      {enhanced ? (
        <>
          <VideoButton
            className="research-video-player__center-control"
            label={paused || ended ? "Play video" : "Pause video"}
            onClick={togglePlayback}
          >
            <LinkIcon kind={paused || ended ? "play" : "pause"} />
          </VideoButton>

          <div
            aria-hidden={!controlsVisible}
            className="research-video-player__bottom-bar"
            data-testid="research-video-bottom-controls"
            inert={!controlsVisible}
          >
            <div className="research-video-player__timeline-row">
              <input
                aria-label="Seek video"
                aria-valuemax={safeDuration}
                aria-valuemin={0}
                aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(safeDuration)}`}
                className="research-video-player__seek"
                max={safeDuration || 0}
                min="0"
                onBlur={() => setSeeking(false)}
                onChange={(event) => changeTime(Number(event.target.value))}
                onFocus={() => {
                  setSeeking(true);
                  showControls();
                }}
                onPointerDown={() => {
                  setSeeking(true);
                  showControls();
                }}
                onPointerUp={() => setSeeking(false)}
                step="0.1"
                type="range"
                value={Math.min(currentTime, safeDuration || currentTime)}
              />
              <span className="research-video-player__time" data-testid="research-video-time">
                {formatDuration(currentTime)} / {formatDuration(safeDuration)}
              </span>
            </div>

            <div className="research-video-player__actions">
              <div className="research-video-player__actions-left">
                <VideoButton label={paused || ended ? "Play video" : "Pause video"} onClick={togglePlayback}>
                  <LinkIcon kind={paused || ended ? "play" : "pause"} />
                </VideoButton>
                <div
                  className="research-video-player__sound"
                  data-open={volumeOpen ? "true" : "false"}
                  onFocusCapture={(event) => {
                    if (suppressSoundFocusRef.current) {
                      suppressSoundFocusRef.current = false;
                      return;
                    }
                    const target = event.target;
                    if (interactionRef.current === "keyboard" || (target instanceof HTMLElement && target.matches(":focus-visible"))) {
                      openVolumeRange();
                    }
                  }}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "touch") return;
                    interactionRef.current = "pointer";
                    openVolumeRange();
                  }}
                  onPointerLeave={schedulePointerVolumeDismissal}
                >
                  <VideoButton
                    ariaControls={soundId}
                    ariaExpanded={volumeOpen}
                    buttonRef={soundButtonRef}
                    label={muted || volume === 0 ? "Unmute video" : "Mute video"}
                    onClick={() => {
                      toggleMute();
                      openVolumeRange();
                    }}
                  >
                    <LinkIcon kind={muted || volume === 0 ? "mute" : "volume"} />
                  </VideoButton>
                  <div
                    aria-hidden={!volumeOpen}
                    className="research-video-player__volume-range"
                    data-open={volumeOpen ? "true" : "false"}
                    data-testid="video-volume-range"
                    id={soundId}
                    inert={!volumeOpen}
                    onPointerEnter={clearSoundDismissTimer}
                    ref={volumeRangeRef}
                  >
                    <input
                      aria-label="Volume"
                      max="1"
                      min="0"
                      onChange={(event) => changeVolume(Number(event.target.value))}
                      onFocus={() => {
                        setVolumePinned(true);
                        setVolumeOpen(true);
                        showControls();
                      }}
                      onPointerCancel={endVolumeDrag}
                      onPointerDown={startVolumeDrag}
                      onPointerUp={endVolumeDrag}
                      step="0.05"
                      type="range"
                      value={muted ? 0 : volume}
                    />
                  </div>
                </div>
              </div>
              <div className="research-video-player__actions-right">
                <VideoButton
                  label={captionsEnabled ? "Disable captions" : "Enable captions"}
                  onClick={() => {
                    onCaptionsEnabledChange(!captionsEnabled);
                  }}
                  pressed={captionsEnabled}
                >
                  <LinkIcon kind="captions" />
                </VideoButton>
                <VideoButton
                  ariaControls={settingsId}
                  ariaExpanded={settingsOpen}
                  buttonRef={setSettingsButton}
                  label="Open video settings"
                  onClick={openSettings}
                  pressed={settingsOpen}
                >
                  <LinkIcon kind="settings" />
                </VideoButton>
                {fullscreenSupported || onRequestExpand ? (
                  <VideoButton
                    label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    onClick={toggleFullscreen}
                  >
                    <LinkIcon kind={fullscreen ? "exit-fullscreen" : "fullscreen"} />
                  </VideoButton>
                ) : null}
              </div>
            </div>
          </div>

          <div
            aria-hidden={!settingsOpen}
            aria-label="Video settings"
            className="research-video-player__settings"
            data-open={settingsOpen ? "true" : "false"}
            data-view={settingsView}
            data-testid="video-settings"
            id={settingsId}
            inert={!settingsOpen}
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") settingsPointerIntentRef.current = false;
              clearSoundDismissTimer();
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "touch" || settingsPinned || hasKeyboardVisibleFocus()) return;
              settingsPointerIntentRef.current = false;
              schedulePointerPopoverDismissal();
            }}
            ref={settingsPopoverRef}
            role="group"
          >
            <div
              aria-hidden={settingsView !== "root"}
              className="research-video-player__settings-root"
              data-open={settingsView === "root" ? "true" : "false"}
              inert={settingsView !== "root"}
            >
              <button
                aria-controls={`${settingsId}-speeds`}
                aria-expanded={settingsView === "speeds"}
                className="research-video-player__settings-item"
                onClick={openSpeedMenu}
                ref={speedMenuButtonRef}
                type="button"
              >
                Playback speed — {playbackRate}×
              </button>
              <div className="research-video-player__settings-secondary">
                {pictureInPictureSupported ? (
                  <button className="research-video-player__settings-item" onClick={togglePictureInPicture} type="button">
                    {inPictureInPicture ? "Exit picture in picture" : "Picture in picture"}
                  </button>
                ) : null}
                {showExpandControl && onRequestExpand && !fullscreen ? (
                  <button className="research-video-player__settings-item" onClick={requestExpandedPlayer} type="button">
                    Open enlarged player
                  </button>
                ) : null}
              </div>
            </div>
            <div
              aria-hidden={settingsView !== "speeds"}
              className="research-video-player__settings-speeds"
              data-open={settingsView === "speeds" ? "true" : "false"}
              id={`${settingsId}-speeds`}
              inert={settingsView !== "speeds"}
            >
              <button className="research-video-player__settings-back" onClick={() => closeSpeedMenu(true)} type="button">
                Back to settings
              </button>
              <div className="research-video-player__speed-options" ref={speedOptionsRef} role="group" aria-label="Playback speed">
                {playbackRates.map((rate) => (
                  <button
                    aria-pressed={playbackRate === rate}
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    type="button"
                  >
                    {rate}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {enhanced && (message || capabilityMessage) ? (
        <p aria-live="polite" className="research-video-player__status" role="status">
          {capabilityMessage || message}
        </p>
      ) : null}
    </div>
  );
}
