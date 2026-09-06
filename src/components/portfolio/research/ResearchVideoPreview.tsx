"use client";

import { useCallback, useEffect, useId, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { GlassIconButton } from "@/components/glass/GlassIconButton";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { LinkIcon } from "@/components/icons/LinkIcon";
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

type VideoToolbarProps = {
  dialogId?: string;
  expandButtonRef?: RefObject<HTMLButtonElement | null>;
  expanded?: boolean;
  onExpand?: () => void;
  title: string;
  video: ResearchVideo;
};

function VideoToolbar({ dialogId, expandButtonRef, expanded, onExpand, title, video }: VideoToolbarProps) {
  const controls = [
    {
      download: false,
      icon: "file",
      label: "Read transcript",
      url: video.transcriptSrc
    },
    {
      download: true,
      icon: "download",
      label: "Download MP4",
      url: video.src
    }
  ] as const;

  return (
    <div aria-label={`${title} video tools`} className="research-video__toolbar" role="group">
      {controls.map(({ download, icon, label, url }) => (
        <GlassIconLink
          className="research-video__toolbar-control"
          data-tooltip={label}
          download={download}
          key={label}
          kind={icon}
          label={label}
          showLabel={false}
          title={label}
          url={url}
        />
      ))}
      {onExpand ? (
        <GlassIconButton
          aria-controls={dialogId}
          aria-expanded={expanded}
          aria-haspopup="dialog"
          className="research-video__toolbar-control"
          data-tooltip="Open enlarged player"
          label={`Expand video for ${title}`}
          onClick={onExpand}
          ref={expandButtonRef}
          title="Open enlarged player"
        >
          <LinkIcon kind="expand" />
        </GlassIconButton>
      ) : null}
    </div>
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
            <p className="research-media-title research-video__title">{video.displayTitle}</p>
            <span className="research-video__duration">{video.durationLabel}</span>
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
          <VideoToolbar
            dialogId={dialogId}
            expandButtonRef={expandButtonRef}
            expanded={open}
            onExpand={openDialog}
            title={title}
            video={video}
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
          <VideoToolbar title={title} video={video} />
        </div>
        <VideoStatusMessage status={modalVideoStatus} />
      </ModalDialog>
    </>
  );
}
