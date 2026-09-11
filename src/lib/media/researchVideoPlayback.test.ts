import { describe, expect, it, vi } from "vitest";
import {
  getSafePlaybackTime,
  pauseAndResetPlayback,
  pausePlayback,
  setPlaybackTime,
  type ResearchVideoPlaybackSurface
} from "@/lib/media/researchVideoPlayback";

function createSurface(currentTime = 0, duration = Number.NaN): ResearchVideoPlaybackSurface {
  return { currentTime, duration, pause: vi.fn() };
}

describe("research video playback transfer", () => {
  it("pauses and rewinds media so reopening cannot resume an earlier timeline", () => {
    const events: string[] = [];
    const outgoing = createSurface(12.5, 60);
    outgoing.pause = vi.fn(() => events.push("pause"));
    Object.defineProperty(outgoing, "currentTime", {
      configurable: true,
      get: () => 0,
      set: () => events.push("seek")
    });

    pauseAndResetPlayback(outgoing);
    expect(events).toEqual(["pause", "seek"]);
    expect(outgoing.pause).toHaveBeenCalledOnce();
  });

  it("clamps a timeline to known duration bounds", () => {
    expect(getSafePlaybackTime(createSurface(80, 60))).toBe(60);

    const incoming = createSurface(0, 25);
    expect(setPlaybackTime(incoming, 40)).toBe(true);
    expect(incoming.currentTime).toBe(25);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    "normalizes an invalid playback time to zero: %s",
    (invalidTime) => {
      const incoming = createSurface(8);

      expect(getSafePlaybackTime(createSurface(invalidTime))).toBe(0);
      pauseAndResetPlayback(incoming);
      expect(incoming.currentTime).toBe(0);
    }
  );

  it("fails closed when detached media operations throw", () => {
    const surface = createSurface();
    surface.pause = () => {
      throw new Error("detached");
    };
    Object.defineProperty(surface, "currentTime", {
      configurable: true,
      get: () => 0,
      set: () => {
        throw new Error("detached");
      }
    });

    expect(() => pausePlayback(surface)).not.toThrow();
    expect(setPlaybackTime(surface, 4)).toBe(false);
  });
});
