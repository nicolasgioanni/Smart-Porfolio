export type ResearchVideoPlaybackSurface = Pick<HTMLMediaElement, "currentTime" | "duration" | "pause">;

export function getSafePlaybackTime(surface: ResearchVideoPlaybackSurface): number {
  const currentTime = surface.currentTime;
  if (!Number.isFinite(currentTime) || currentTime < 0) return 0;

  const duration = surface.duration;
  return Number.isFinite(duration) && duration >= 0 ? Math.min(currentTime, duration) : currentTime;
}

export function pausePlayback(surface: ResearchVideoPlaybackSurface | null | undefined): void {
  if (!surface) return;

  try {
    surface.pause();
  } catch {
    // A detached or unsupported media element is already unable to continue playback.
  }
}

export function pauseAndResetPlayback(surface: ResearchVideoPlaybackSurface | null | undefined): void {
  pausePlayback(surface);
  setPlaybackTime(surface, 0);
}

export function setPlaybackTime(
  surface: ResearchVideoPlaybackSurface | null | undefined,
  requestedTime: number
): boolean {
  if (!surface) return false;

  const finiteTime = Number.isFinite(requestedTime) && requestedTime >= 0 ? requestedTime : 0;
  const duration = surface.duration;
  const safeTime = Number.isFinite(duration) && duration >= 0 ? Math.min(finiteTime, duration) : finiteTime;

  try {
    surface.currentTime = safeTime;
    return true;
  } catch {
    return false;
  }
}

export function pauseAndTransferPlayback(
  outgoing: ResearchVideoPlaybackSurface | null | undefined,
  incoming: ResearchVideoPlaybackSurface | null | undefined
): number {
  const playbackTime = outgoing ? getSafePlaybackTime(outgoing) : 0;
  pausePlayback(outgoing);
  setPlaybackTime(incoming, playbackTime);
  return playbackTime;
}
