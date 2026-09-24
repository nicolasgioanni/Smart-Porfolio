"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ResearchMediaDialog } from "@/components/portfolio/research/ResearchMediaDialog";
import { ResearchVideoPlayer } from "@/components/portfolio/research/ResearchVideoPlayer";
import type { ResearchGraphicalAbstract } from "@/lib/content/researchGraphicalAbstracts";
import type { ResearchVideo } from "@/lib/content/researchVideos";
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
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const componentId = useId().replaceAll(":", "");
  const dialogId = `research-video-${componentId}`;
  const dialogDescriptionId = `${dialogId}-description`;
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
    setOpen(false);
  }, [modalPlaybackSettings]);

  return (
    <>
      <section aria-label={`${title} video`} className="research-video">
        <div className="research-video__header">
          <div>
            <p className="research-media-title research-video__title">{video.displayTitle}</p>
            <span className="research-video__duration">{video.durationLabel}</span>
          </div>
        </div>
        <ResearchVideoPlayer
          captionsEnabled={captionsEnabled}
          className="research-video__viewport"
          expandButtonRef={expandButtonRef}
          keepControlsVisible={preserveInlineControls}
          label={inlineLabel}
          onCaptionsEnabledChange={setCaptionsEnabled}
          onPlay={() => pausePlayback(modalVideoRef.current)}
          onRequestExpand={openDialog}
          playbackSettings={inlinePlaybackSettings}
          playbackTransferKey={inlineTransferKey}
          poster={poster}
          showExpandControl
          video={video}
          videoRef={inlineVideoRef}
        />
        <a className="research-video__transcript" data-testid="read-transcript" href={video.transcriptSrc} rel="noreferrer" target="_blank">
          Read transcript
        </a>
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
        <ResearchVideoPlayer
          captionsEnabled={captionsEnabled}
          className="research-media-dialog__video"
          label={`${inlineLabel}, enlarged`}
          onCaptionsEnabledChange={setCaptionsEnabled}
          onPlay={() => pausePlayback(inlineVideoRef.current)}
          playbackSettings={modalPlaybackSettings}
          playbackTransferKey={modalTransferKey}
          poster={poster}
          video={video}
          videoRef={modalVideoRef}
        />
      </ResearchMediaDialog>
    </>
  );
}
