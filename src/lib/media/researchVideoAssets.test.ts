import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Mp4Box = {
  dataEnd: number;
  dataStart: number;
  end: number;
  start: number;
  type: string;
};

const publicResearchDirectory = path.join(process.cwd(), "public", "images", "research");
const videoPath = path.join(publicResearchDirectory, "cytocv-supplementary-video-s1.mp4");
const captionsPath = path.join(publicResearchDirectory, "cytocv-supplementary-video-s1.en.vtt");
const transcriptPath = path.join(publicResearchDirectory, "cytocv-supplementary-video-s1-transcript.txt");
const expectedVideoSha256 = "8cb4dbbc23556826de641be434e7c04b30796c87691e0166c0510a2af74ca143";
const expectedCaptionsSha256 = "ff138aefd1d420d160322bc9c39328b3212220827a23b57b3c30226e1083ce8f";
const expectedTranscriptSha256 = "309d98221f512e91430b1ed70c990c7ae6816f31e2ac89f295cfa957d8d30f1a";

function readUint64(buffer: Buffer, offset: number): number {
  const value = buffer.readBigUInt64BE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("MP4 box size exceeds the supported contract range.");
  return Number(value);
}

function parseBoxes(buffer: Buffer, start = 0, end = buffer.length): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let offset = start;

  while (offset < end) {
    if (end - offset < 8) throw new Error("MP4 box header is truncated.");

    const declaredSize = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const headerLength = declaredSize === 1 ? 16 : 8;
    const size = declaredSize === 1 ? readUint64(buffer, offset + 8) : declaredSize === 0 ? end - offset : declaredSize;

    if (size < headerLength || offset + size > end) throw new Error(`Invalid MP4 ${type} box size.`);

    boxes.push({
      dataEnd: offset + size,
      dataStart: offset + headerLength,
      end: offset + size,
      start: offset,
      type
    });
    offset += size;
  }

  if (offset !== end) throw new Error("MP4 box parsing did not end on the expected boundary.");
  return boxes;
}

function childBox(buffer: Buffer, parent: Mp4Box, type: string): Mp4Box {
  const box = parseBoxes(buffer, parent.dataStart, parent.dataEnd).find((candidate) => candidate.type === type);
  if (!box) throw new Error(`MP4 is missing required ${type} box.`);
  return box;
}

function fullBoxTiming(buffer: Buffer, box: Mp4Box): { duration: number; timeScale: number } {
  const version = buffer[box.dataStart];
  if (version === 0) {
    return {
      duration: buffer.readUInt32BE(box.dataStart + 16),
      timeScale: buffer.readUInt32BE(box.dataStart + 12)
    };
  }

  if (version === 1) {
    return {
      duration: readUint64(buffer, box.dataStart + 24),
      timeScale: buffer.readUInt32BE(box.dataStart + 20)
    };
  }

  throw new Error(`Unsupported MP4 full-box version ${version}.`);
}

function handlerType(buffer: Buffer, track: Mp4Box): string {
  const hdlr = childBox(buffer, childBox(buffer, track, "mdia"), "hdlr");
  return buffer.toString("ascii", hdlr.dataStart + 8, hdlr.dataStart + 12);
}

function sampleEntryType(buffer: Buffer, track: Mp4Box): string {
  const stbl = childBox(buffer, childBox(buffer, childBox(buffer, track, "mdia"), "minf"), "stbl");
  const stsd = childBox(buffer, stbl, "stsd");
  const entryCount = buffer.readUInt32BE(stsd.dataStart + 4);
  if (entryCount !== 1 || stsd.dataEnd - stsd.dataStart < 16) throw new Error("MP4 has an unexpected sample-description table.");
  return buffer.toString("ascii", stsd.dataStart + 12, stsd.dataStart + 16);
}

function trackDimensions(buffer: Buffer, track: Mp4Box): { height: number; width: number } {
  const tkhd = childBox(buffer, track, "tkhd");
  const version = buffer[tkhd.dataStart];
  const widthOffset = version === 0 ? 76 : version === 1 ? 88 : -1;
  if (widthOffset < 0 || tkhd.dataEnd - tkhd.dataStart < widthOffset + 8) {
    throw new Error("MP4 has an unsupported track-header layout.");
  }

  return {
    height: buffer.readUInt32BE(tkhd.dataStart + widthOffset + 4) / 65536,
    width: buffer.readUInt32BE(tkhd.dataStart + widthOffset) / 65536
  };
}

function parseTimestamp(value: string): number {
  const match = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/.exec(value);
  if (!match) throw new Error(`Invalid WebVTT timestamp: ${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

describe("CytoCV supplementary video assets", () => {
  it("locks the authorized self-hosted MP4 bytes and ISO media streams without requiring ffprobe", () => {
    const asset = readFileSync(videoPath);
    const boxes = parseBoxes(asset);
    const movie = boxes.find((box) => box.type === "moov");
    const fileType = boxes.find((box) => box.type === "ftyp");

    expect(statSync(videoPath).size).toBe(14_938_147);
    expect(createHash("sha256").update(asset).digest("hex")).toBe(expectedVideoSha256);
    expect(fileType).toBeDefined();
    expect(asset.toString("ascii", fileType!.dataStart, fileType!.dataEnd)).toContain("isom");
    expect(movie).toBeDefined();

    const movieTiming = fullBoxTiming(asset, childBox(asset, movie!, "mvhd"));
    expect(movieTiming).toEqual({ duration: 328_440, timeScale: 1_000 });

    const tracks = parseBoxes(asset, movie!.dataStart, movie!.dataEnd).filter((box) => box.type === "trak");
    const videoTrack = tracks.find((track) => handlerType(asset, track) === "vide");
    const audioTrack = tracks.find((track) => handlerType(asset, track) === "soun");

    expect(videoTrack).toBeDefined();
    expect(audioTrack).toBeDefined();
    expect(trackDimensions(asset, videoTrack!)).toEqual({ height: 1108, width: 1710 });
    expect(sampleEntryType(asset, videoTrack!)).toBe("avc1");
    expect(sampleEntryType(asset, audioTrack!)).toBe("mp4a");
    expect(fullBoxTiming(asset, childBox(asset, childBox(asset, videoTrack!, "mdia"), "mdhd"))).toEqual({
      duration: 4_204_032,
      timeScale: 12_800
    });
    expect(fullBoxTiming(asset, childBox(asset, childBox(asset, audioTrack!, "mdia"), "mdhd"))).toEqual({
      duration: 15_764_537,
      timeScale: 48_000
    });
  });

  it("locks the reviewed captions and readable transcript to the narrated source timeline", () => {
    const captions = readFileSync(captionsPath, "utf8");
    const transcript = readFileSync(transcriptPath, "utf8");
    const cueMatches = [...captions.matchAll(/^(\d+)\r?\n(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\r?\n([\s\S]*?)(?=\r?\n\r?\n\d+\r?\n|\r?\n*$)/gm)];

    expect(createHash("sha256").update(captions).digest("hex")).toBe(expectedCaptionsSha256);
    expect(createHash("sha256").update(transcript).digest("hex")).toBe(expectedTranscriptSha256);
    expect(captions.startsWith("WEBVTT\r\n") || captions.startsWith("WEBVTT\n")).toBe(true);
    expect(cueMatches).toHaveLength(84);

    let previousEnd = 0;
    for (const [index, cue] of cueMatches.entries()) {
      const start = parseTimestamp(cue[2]!);
      const end = parseTimestamp(cue[3]!);
      expect(cue[1]).toBe(String(index + 1));
      expect(start).toBeGreaterThanOrEqual(previousEnd);
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(328.44);
      previousEnd = end;
    }

    expect(cueMatches[0]?.[2]).toBe("00:00:00.430");
    expect(cueMatches.at(-1)?.[3]).toBe("00:05:27.380");
    expect(captions).toContain("large-budded cell pairs");
    expect(captions).toContain("CytoCV");
    expect(captions).toContain("DIC image");
    expect(transcript).toContain("CytoCV Supplementary Video S1");
    expect(transcript).toContain("nuclear versus cytoplasmic intensities");
  });
});
