"use client";

import { useCallback, useEffect, useId, useRef, useState, type MutableRefObject } from "react";
import { ModalDialog } from "@/components/overlay/ModalDialog";
import type { ResearchGraphicalAbstract } from "@/lib/content/researchGraphicalAbstracts";
import type { ResearchVideo } from "@/lib/content/researchVideos";
import { pauseAndTransferPlayback, pausePlayback, setPlaybackTime } from "@/lib/media/researchVideoPlayback";

type ResearchVideoPreviewProps = {
  poster: ResearchGraphicalAbstract;
  title: string;
  video: ResearchVideo;
};

type VideoStatus = "ended" | "error" | "loading" | "ready";

type ScientificVideoPlayerProps = {
  className: string;
  label: string;
  onEnded: () => void;
  onError: () => void;
  onLoadedData: () => void;
  onLoadedMetadata: () => void;
  onLoadStart: () => void;
  onPlay: () => void;
  onVideoElementAvailable?: (videoElement: HTMLVideoElement | null) => void;
  poster: ResearchGraphicalAbstract;
  video: ResearchVideo;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
};

function ScientificVideoPlayer({
  className,
  label,
  onEnded,
  onError,
  onLoadedData,
  onLoadedMetadata,
  onLoadStart,
  onPlay,
  onVideoElementAvailable,
  poster,
  video,
  videoRef
}: ScientificVideoPlayerProps) {
  const setVideoRef = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      videoRef.current = videoElement;
      onVideoElementAvailable?.(videoElement);
    },
    [onVideoElementAvailable, videoRef]
  );

  return (
    <video
      aria-label={label}
      className={className}
      controls
      height={video.height}
      onEnded={onEnded}
      onError={onError}
      onLoadedData={onLoadedData}
      onLoadedMetadata={onLoadedMetadata}
      onLoadStart={onLoadStart}
      onPlay={onPlay}
      playsInline
      poster={poster.src}
      preload="metadata"
      ref={setVideoRef}
      width={video.width}
    >
      <source src={video.src} type={video.mimeType} />
      <track default kind="captions" label="English" src={video.captionsSrc} srcLang="en" />
      Your browser cannot play this video. Use the download link or read the transcript below.
    </video>
  );
}

function VideoStatusMessage({ status }: { status: VideoStatus }) {
  if (status === "ready") return null;

  return (
    <p aria-live="polite" className="research-video__status" role="status">
      {status === "loading" && "Loading video metadata."}
      {status === "ended" && "Video ended. Use the video controls to replay it."}
      {status === "error" && "Video playback is unavailable. Use the download or transcript link."}
    </p>
  );
}

function applyPendingPlaybackTime(videoElement: HTMLVideoElement | null, pendingTimeRef: { current: number | null }) {
  if (pendingTimeRef.current === null) return;
  if (setPlaybackTime(videoElement, pendingTimeRef.current)) pendingTimeRef.current = null;
}

function getLoadedVideoStatus(videoElement: HTMLVideoElement | null): VideoStatus | undefined {
  if (!videoElement) return undefined;
  if (videoElement.error) return "error";
  return videoElement.readyState >= HTMLMediaElement.HAVE_METADATA ? "ready" : undefined;
}

export function ResearchVideoPreview({ poster, title, video }: ResearchVideoPreviewProps) {
  const [open, setOpen] = useState(false);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const pendingInlineTimeRef = useRef<number | null>(null);
  const pendingModalTimeRef = useRef<number | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [inlineVideoStatus, setInlineVideoStatus] = useState<VideoStatus>("loading");
  const [modalVideoStatus, setModalVideoStatus] = useState<VideoStatus>("loading");
  const componentId = useId().replaceAll(":", "");
  const dialogId = `research-video-${componentId}`;
  const dialogDescriptionId = `${dialogId}-description`;
  const inlineLabel = `${title} supplementary workflow video`;
  const applyModalPlaybackTime = useCallback(
    (videoElement: HTMLVideoElement | null) => applyPendingPlaybackTime(videoElement, pendingModalTimeRef),
    []
  );

  useEffect(
    () => () => {
      pausePlayback(inlineVideoRef.current);
      pausePlayback(modalVideoRef.current);
    },
    []
  );

  useEffect(() => {
    const loadedStatus = getLoadedVideoStatus(inlineVideoRef.current);
    if (loadedStatus) setInlineVideoStatus(loadedStatus);
  }, []);

  useEffect(() => {
    if (open) {
      applyPendingPlaybackTime(modalVideoRef.current, pendingModalTimeRef);
      return;
    }

    const loadedStatus = getLoadedVideoStatus(inlineVideoRef.current);
    if (loadedStatus) setInlineVideoStatus(loadedStatus);
  }, [open]);

  function openDialog() {
    pendingModalTimeRef.current = pauseAndTransferPlayback(inlineVideoRef.current, undefined);
    setModalVideoStatus("loading");
    setOpen(true);
  }

  function closeDialog() {
    pendingInlineTimeRef.current = pauseAndTransferPlayback(modalVideoRef.current, inlineVideoRef.current);
    applyPendingPlaybackTime(inlineVideoRef.current, pendingInlineTimeRef);
    setOpen(false);
  }

  return (
    <>
      <section aria-label={`${title} video`} className="research-video">
        <div className="research-video__header">
          <div>
            <p className="research-video__title">Scientific workflow video</p>
            <span className="research-video__duration">{video.durationLabel}</span>
          </div>
          <div className="research-video__actions">
            <a className="research-video__transcript hover-base-1 hover-base-1--compact" href={video.transcriptSrc}>
              Read transcript
            </a>
            <a className="research-video__download hover-base-1 hover-base-1--compact" download href={video.src}>
              Download MP4
            </a>
            <button
              aria-controls={dialogId}
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label={`Expand video for ${title}`}
              className="research-video__expand hover-base-1 hover-base-1--compact"
              onClick={openDialog}
              ref={expandButtonRef}
              type="button"
            >
              Open enlarged player
            </button>
          </div>
        </div>
        <div className="research-video__viewport">
          <ScientificVideoPlayer
            className="research-video__player"
            label={inlineLabel}
            onEnded={() => setInlineVideoStatus("ended")}
            onError={() => setInlineVideoStatus("error")}
            onLoadedData={() => setInlineVideoStatus("ready")}
            onLoadedMetadata={() => {
              applyPendingPlaybackTime(inlineVideoRef.current, pendingInlineTimeRef);
              setInlineVideoStatus("ready");
            }}
            onLoadStart={() => setInlineVideoStatus("loading")}
            onPlay={() => {
              pausePlayback(modalVideoRef.current);
              setInlineVideoStatus("ready");
            }}
            poster={poster}
            video={video}
            videoRef={inlineVideoRef}
          />
        </div>
        <VideoStatusMessage status={inlineVideoStatus} />
      </section>

      <ModalDialog
        ariaDescribedBy={dialogDescriptionId}
        ariaLabel={`${title} supplementary workflow video`}
        dialogId={dialogId}
        frameClassName="research-video-dialog__frame"
        initialFocusRef={closeButtonRef}
        onRequestClose={closeDialog}
        open={open}
        restoreFocusRef={expandButtonRef}
        rootClassName="research-video-dialog"
      >
        <p className="visually-hidden" id={dialogDescriptionId}>
          {video.description} Captions are available from the video controls. Playback remains paused while its timeline is transferred between views.
        </p>
        <button
          aria-label={`Close video for ${title}`}
          className="research-video-dialog__close hover-base-1 hover-base-1--compact"
          onClick={closeDialog}
          ref={closeButtonRef}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="research-video-dialog__viewport">
          <ScientificVideoPlayer
            className="research-video-dialog__player"
            label={`${inlineLabel}, enlarged`}
            onEnded={() => setModalVideoStatus("ended")}
            onError={() => setModalVideoStatus("error")}
            onLoadedData={() => setModalVideoStatus("ready")}
            onLoadedMetadata={() => {
              applyPendingPlaybackTime(modalVideoRef.current, pendingModalTimeRef);
              setModalVideoStatus("ready");
            }}
            onLoadStart={() => setModalVideoStatus("loading")}
            onPlay={() => {
              pausePlayback(inlineVideoRef.current);
              setModalVideoStatus("ready");
            }}
            poster={poster}
            video={video}
            onVideoElementAvailable={applyModalPlaybackTime}
            videoRef={modalVideoRef}
          />
        </div>
        <div className="research-video-dialog__resources">
          <a className="research-video__transcript hover-base-1 hover-base-1--compact" href={video.transcriptSrc}>
            Read transcript
          </a>
          <a className="research-video__download hover-base-1 hover-base-1--compact" download href={video.src}>
            Download MP4
          </a>
        </div>
        <VideoStatusMessage status={modalVideoStatus} />
      </ModalDialog>
    </>
  );
}
