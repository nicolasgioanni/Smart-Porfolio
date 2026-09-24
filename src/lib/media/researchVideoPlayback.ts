export type ResearchVideoPlaybackSurface = Pick<
  HTMLMediaElement,
  "currentTime" | "duration" | "muted" | "pause" | "playbackRate" | "volume"
>;

export type ResearchVideoPlaybackSettings = {
  currentTime: number;
  muted: boolean;
  playbackRate: number;
  volume: number;
};

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

function getSafeVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 1;
  return Math.min(1, Math.max(0, volume));
}

function getSafePlaybackRate(playbackRate: number): number {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) return 1;
  return Math.min(2, Math.max(0.5, playbackRate));
}

export function getPlaybackSettings(surface: ResearchVideoPlaybackSurface): ResearchVideoPlaybackSettings {
  return {
    currentTime: getSafePlaybackTime(surface),
    muted: Boolean(surface.muted),
    playbackRate: getSafePlaybackRate(surface.playbackRate),
    volume: getSafeVolume(surface.volume)
  };
}

export function applyPlaybackSettings(
  surface: ResearchVideoPlaybackSurface | null | undefined,
  settings: ResearchVideoPlaybackSettings
): boolean {
  if (!surface) return false;

  try {
    surface.muted = settings.muted;
    surface.volume = getSafeVolume(settings.volume);
    surface.playbackRate = getSafePlaybackRate(settings.playbackRate);
  } catch {
    return false;
  }

  return setPlaybackTime(surface, settings.currentTime);
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
