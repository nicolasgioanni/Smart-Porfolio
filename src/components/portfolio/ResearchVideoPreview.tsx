"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ModalDialog } from "@/components/overlay/ModalDialog";
import type { ResearchGraphicalAbstract } from "@/lib/content/researchGraphicalAbstracts";
import type { ResearchVideo } from "@/lib/content/researchVideos";
import { pauseAndResetPlayback, pausePlayback } from "@/lib/media/researchVideoPlayback";

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
  onLoadStart: () => void;
  onPlay: () => void;
  poster: ResearchGraphicalAbstract;
  video: ResearchVideo;
  videoRef: RefObject<HTMLVideoElement>;
};

function ScientificVideoPlayer({
  className,
  label,
  onEnded,
  onError,
  onLoadedData,
  onLoadStart,
  onPlay,
  poster,
  video,
  videoRef
}: ScientificVideoPlayerProps) {
  return (
    <video
      aria-label={label}
      className={className}
      controls
      height={video.height}
      onEnded={onEnded}
      onError={onError}
      onLoadedData={onLoadedData}
      onLoadStart={onLoadStart}
      onPlay={onPlay}
      playsInline
      poster={poster.src}
      preload="metadata"
      ref={videoRef}
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

export function ResearchVideoPreview({ poster, title, video }: ResearchVideoPreviewProps) {
  const [open, setOpen] = useState(false);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("loading");
  const componentId = useId().replaceAll(":", "");
  const dialogId = `research-video-${componentId}`;
  const dialogDescriptionId = `${dialogId}-description`;
  const inlineLabel = `${title} supplementary workflow video`;

  useEffect(
    () => () => {
      pauseAndResetPlayback(inlineVideoRef.current);
      pauseAndResetPlayback(modalVideoRef.current);
    },
    []
  );

  function openDialog() {
    pauseAndResetPlayback(inlineVideoRef.current);
    pauseAndResetPlayback(modalVideoRef.current);
    setOpen(true);
  }

  function closeDialog() {
    pauseAndResetPlayback(modalVideoRef.current);
    pauseAndResetPlayback(inlineVideoRef.current);
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
            onEnded={() => setVideoStatus("ended")}
            onError={() => setVideoStatus("error")}
            onLoadedData={() => setVideoStatus("ready")}
            onLoadStart={() => setVideoStatus("loading")}
            onPlay={() => pausePlayback(modalVideoRef.current)}
            poster={poster}
            video={video}
            videoRef={inlineVideoRef}
          />
        </div>
        <VideoStatusMessage status={videoStatus} />
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
          {video.description} Captions are available from the video controls. Playback is paused and reset whenever this enlarged view opens or closes.
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
            onEnded={() => setVideoStatus("ended")}
            onError={() => setVideoStatus("error")}
            onLoadedData={() => setVideoStatus("ready")}
            onLoadStart={() => setVideoStatus("loading")}
            onPlay={() => pausePlayback(inlineVideoRef.current)}
            poster={poster}
            video={video}
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
        <VideoStatusMessage status={videoStatus} />
      </ModalDialog>
    </>
  );
}
