"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ModalDialog } from "@/components/overlay/ModalDialog";
import { ResearchMediaDialog } from "@/features/research/components/ResearchMediaDialog";
import { ResearchVideoPlayer } from "@/features/research/components/ResearchVideoPlayer";
import type { ResearchGraphicalAbstract } from "@/features/research/content/researchGraphicalAbstracts";
import type { ResearchVideo } from "@/features/research/content/researchVideos";
import { getPlaybackSettings, pausePlayback, type ResearchVideoPlaybackSettings } from "@/lib/media/researchVideoPlayback";

type ResearchVideoPreviewProps = {
  poster: ResearchGraphicalAbstract;
  title: string;
  video: ResearchVideo;
};

function getPausedPlaybackSettings(videoElement: HTMLVideoElement | null): ResearchVideoPlaybackSettings | undefined {
  if (!videoElement) return undefined;
  pausePlayback(videoElement);
  return getPlaybackSettings(videoElement);
}

export function ResearchVideoPreview({ poster, title, video }: ResearchVideoPreviewProps) {
  const [open, setOpen] = useState(false);
  const [preserveInlineControls, setPreserveInlineControls] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [modalPlaybackSettings, setModalPlaybackSettings] = useState<ResearchVideoPlaybackSettings>();
  const [inlinePlaybackSettings, setInlinePlaybackSettings] = useState<ResearchVideoPlaybackSettings>();
  const [modalTransferKey, setModalTransferKey] = useState(0);
  const [inlineTransferKey, setInlineTransferKey] = useState(0);
  const [fullscreenFallbackOpen, setFullscreenFallbackOpen] = useState(false);
  const [fullscreenFallbackFailed, setFullscreenFallbackFailed] = useState(false);
  const [modalFullscreenFallbackOpen, setModalFullscreenFallbackOpen] = useState(false);
  const [modalFullscreenFallbackFailed, setModalFullscreenFallbackFailed] = useState(false);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreenCloseRef = useRef<HTMLButtonElement>(null);
  const modalFullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const modalFullscreenCloseRef = useRef<HTMLButtonElement>(null);
  const componentId = useId().replaceAll(":", "");
  const dialogId = `research-video-${componentId}`;
  const dialogDescriptionId = `${dialogId}-description`;
  const fullscreenDialogId = `${dialogId}-fullscreen`;
  const inlineLabel = `${title} supplementary workflow video`;

  useEffect(
    () => () => {
      pausePlayback(inlineVideoRef.current);
      pausePlayback(modalVideoRef.current);
    },
    []
  );

  const openDialog = useCallback(() => {
    const startDialog = () => {
      const snapshot = getPausedPlaybackSettings(inlineVideoRef.current);
      if (snapshot) {
        setModalPlaybackSettings(snapshot);
        setModalTransferKey((value) => value + 1);
      }
      setPreserveInlineControls(true);
      setOpen(true);
    };

    if (document.fullscreenElement) {
      void document.exitFullscreen().then(startDialog).catch(() => undefined);
      return;
    }

    startDialog();
  }, []);

  const closeDialog = useCallback(() => {
    const modalVideo = modalVideoRef.current;
    pausePlayback(modalVideo);
    const liveSettings = modalVideo ? getPlaybackSettings(modalVideo) : undefined;
    const snapshot =
      liveSettings && (modalVideo!.readyState >= HTMLMediaElement.HAVE_METADATA || liveSettings.currentTime > 0)
        ? liveSettings
        : modalPlaybackSettings && liveSettings
          ? { ...liveSettings, currentTime: modalPlaybackSettings.currentTime }
          : modalPlaybackSettings ?? liveSettings;
    if (snapshot) {
      setInlinePlaybackSettings(snapshot);
      setInlineTransferKey((value) => value + 1);
    }
    setModalFullscreenFallbackOpen(false);
    setOpen(false);
  }, [modalPlaybackSettings]);

  const openFullscreenFallback = useCallback(() => {
    setFullscreenFallbackFailed(false);
    setFullscreenFallbackOpen(true);
  }, []);

  const closeFullscreenFallback = useCallback(() => {
    setFullscreenFallbackOpen(false);
  }, []);

  const openModalFullscreenFallback = useCallback(() => {
    setModalFullscreenFallbackFailed(false);
    setModalFullscreenFallbackOpen(true);
  }, []);

  const closeModalFullscreenFallback = useCallback(() => {
    setModalFullscreenFallbackOpen(false);
  }, []);

  return (
    <>
      <section aria-label={`${title} video`} className="research-video">
        <div className="research-video__header">
          <div>
            <p className="research-media-title research-video__title">{video.displayTitle}</p>
            <span className="research-video__duration">{video.durationLabel}</span>
          </div>
        </div>
        <ModalDialog
          ariaLabel={`${inlineLabel} fullscreen`}
          dataTestId="research-video-fullscreen"
          dialogId={fullscreenDialogId}
          frameClassName="research-video-fullscreen__frame"
          initialFocusRef={fullscreenCloseRef}
          onOpenError={() => {
            setFullscreenFallbackOpen(false);
            setFullscreenFallbackFailed(true);
          }}
          onRequestClose={closeFullscreenFallback}
          open={fullscreenFallbackOpen}
          presentation="in-place"
          restoreFocusRef={fullscreenButtonRef}
          rootClassName="research-video-fullscreen"
        >
          <button
            aria-label="Exit fullscreen"
            className="research-video-fullscreen__exit"
            hidden={!fullscreenFallbackOpen}
            onClick={closeFullscreenFallback}
            ref={fullscreenCloseRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
          <ResearchVideoPlayer
            captionsEnabled={captionsEnabled}
            className="research-video__viewport"
            expandButtonRef={expandButtonRef}
            fullscreenButtonRef={fullscreenButtonRef}
            fullscreenFallbackActive={fullscreenFallbackOpen}
            fullscreenFallbackFailed={fullscreenFallbackFailed}
            keepControlsVisible={preserveInlineControls}
            label={inlineLabel}
            onCaptionsEnabledChange={setCaptionsEnabled}
            onExitFullscreenFallback={closeFullscreenFallback}
            onPlay={() => pausePlayback(modalVideoRef.current)}
            onRequestExpand={openDialog}
            onRequestFullscreenFallback={openFullscreenFallback}
            playbackSettings={inlinePlaybackSettings}
            playbackTransferKey={inlineTransferKey}
            poster={poster}
            showExpandControl
            video={video}
            videoRef={inlineVideoRef}
          />
        </ModalDialog>
      </section>

      <ResearchMediaDialog
        ariaDescribedBy={dialogDescriptionId}
        ariaLabel={`${title} supplementary workflow video`}
        closeLabel={`Close video for ${title}`}
        dialogId={dialogId}
        frameClassName="research-media-dialog__frame--video"
        kind="video"
        onAfterClose={() => setPreserveInlineControls(false)}
        onRequestClose={closeDialog}
        open={open}
        restoreFocusRef={expandButtonRef}
      >
        <p className="visually-hidden" id={dialogDescriptionId}>
          {video.description} English captions are available. Playback remains paused while its timeline and settings move between views.
        </p>
        <ModalDialog
          ariaLabel={`${inlineLabel} enlarged fullscreen`}
          dataTestId="research-video-modal-fullscreen"
          dialogId={`${fullscreenDialogId}-modal`}
          frameClassName="research-video-fullscreen__frame"
          initialFocusRef={modalFullscreenCloseRef}
          onOpenError={() => {
            setModalFullscreenFallbackOpen(false);
            setModalFullscreenFallbackFailed(true);
          }}
          onRequestClose={closeModalFullscreenFallback}
          open={modalFullscreenFallbackOpen}
          presentation="in-place"
          restoreFocusRef={modalFullscreenButtonRef}
          rootClassName="research-video-fullscreen research-video-fullscreen--nested"
        >
          <button
            aria-label="Exit fullscreen"
            className="research-video-fullscreen__exit"
            hidden={!modalFullscreenFallbackOpen}
            onClick={closeModalFullscreenFallback}
            ref={modalFullscreenCloseRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
          <ResearchVideoPlayer
            captionsEnabled={captionsEnabled}
            className="research-media-dialog__video"
            fullscreenButtonRef={modalFullscreenButtonRef}
            fullscreenFallbackActive={modalFullscreenFallbackOpen}
            fullscreenFallbackFailed={modalFullscreenFallbackFailed}
            label={`${inlineLabel}, enlarged`}
            onCaptionsEnabledChange={setCaptionsEnabled}
            onExitFullscreenFallback={closeModalFullscreenFallback}
            onPlay={() => pausePlayback(inlineVideoRef.current)}
            onRequestFullscreenFallback={openModalFullscreenFallback}
            playbackSettings={modalPlaybackSettings}
            playbackTransferKey={modalTransferKey}
            poster={poster}
            video={video}
            videoRef={modalVideoRef}
          />
        </ModalDialog>
      </ResearchMediaDialog>
    </>
  );
}
