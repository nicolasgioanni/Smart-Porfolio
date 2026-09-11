import { createHash } from "node:crypto";
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Mp4Box = {
  dataEnd: number;
  dataStart: number;
  depth: number;
  end: number;
  start: number;
  type: string;
};

type Mp4ParseBudget = {
  boxCount: number;
};

const publicResearchDirectory = path.join(process.cwd(), "public", "images", "research");
const videoPath = path.join(publicResearchDirectory, "cytocv-supplementary-video-s1.mp4");
const captionsPath = path.join(publicResearchDirectory, "cytocv-supplementary-video-s1.en.vtt");
const transcriptPath = path.join(publicResearchDirectory, "cytocv-supplementary-video-s1-transcript.txt");
const expectedVideoSha256 = "8cb4dbbc23556826de641be434e7c04b30796c87691e0166c0510a2af74ca143";
const expectedCaptionsSha256 = "86a1c264126eee49143abc3ffbb411f753232b3c64053cf7f533a8efce61104b";
const expectedTranscriptSha256 = "0182483a8a72aeba8712e5319e62a477e933a6843471509218621e231951dc8e";
const maxVideoBytes = 16 * 1024 * 1024;
const maxCaptionsBytes = 64 * 1024;
const maxTranscriptBytes = 64 * 1024;
const maxMp4BoxBytes = maxVideoBytes;
const maxMp4BoxCount = 4_096;
const maxMp4BoxDepth = 8;

function readBoundedAsset(assetPath: string, maxBytes: number, label: string): Buffer {
  const descriptor = openSync(assetPath, "r");

  try {
    const size = fstatSync(descriptor).size;
    if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
      throw new Error(`${label} asset size is outside the ${maxBytes}-byte contract.`);
    }

    const asset = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const bytesRead = readSync(descriptor, asset, offset, size - offset, offset);
      if (bytesRead === 0) throw new Error(`${label} asset ended before its stated size.`);
      offset += bytesRead;
    }

    const growthProbe = Buffer.allocUnsafe(1);
    if (readSync(descriptor, growthProbe, 0, 1, size) !== 0 || fstatSync(descriptor).size !== size) {
      throw new Error(`${label} asset changed while it was being read.`);
    }

    return asset;
  } finally {
    closeSync(descriptor);
  }
}

function readUint64(buffer: Buffer, offset: number): number {
  const value = buffer.readBigUInt64BE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("MP4 box size exceeds the supported contract range.");
  return Number(value);
}

function parseBoxes(buffer: Buffer, start = 0, end = buffer.length, depth = 0, budget: Mp4ParseBudget = { boxCount: 0 }): Mp4Box[] {
  if (buffer.length > maxVideoBytes) throw new Error("MP4 input exceeds the byte ceiling.");
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > buffer.length) {
    throw new Error("MP4 parsing received invalid byte boundaries.");
  }
  if (depth > maxMp4BoxDepth) throw new Error("MP4 box nesting exceeds the depth ceiling.");

  const boxes: Mp4Box[] = [];
  let offset = start;

  while (offset < end) {
    if (end - offset < 8) throw new Error("MP4 box header is truncated.");

    const declaredSize = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (!/^[\x20-\x7e]{4}$/.test(type)) throw new Error("MP4 box type is invalid.");
    if (declaredSize === 1 && end - offset < 16) throw new Error("MP4 extended box header is truncated.");
    const headerLength = declaredSize === 1 ? 16 : 8;
    const size = declaredSize === 1 ? readUint64(buffer, offset + 8) : declaredSize === 0 ? end - offset : declaredSize;

    if (!Number.isSafeInteger(size) || size < headerLength || size > maxMp4BoxBytes || size > end - offset) {
      throw new Error(`Invalid MP4 ${type} box size.`);
    }
    budget.boxCount += 1;
    if (budget.boxCount > maxMp4BoxCount) throw new Error("MP4 box count exceeds the ceiling.");

    boxes.push({
      dataEnd: offset + size,
      dataStart: offset + headerLength,
      depth,
      end: offset + size,
      start: offset,
      type
    });
    offset += size;
  }

  if (offset !== end) throw new Error("MP4 box parsing did not end on the expected boundary.");
  return boxes;
}

function childBox(buffer: Buffer, parent: Mp4Box, type: string, budget: Mp4ParseBudget): Mp4Box {
  const box = parseBoxes(buffer, parent.dataStart, parent.dataEnd, parent.depth + 1, budget).find(
    (candidate) => candidate.type === type
  );
  if (!box) throw new Error(`MP4 is missing required ${type} box.`);
  return box;
}

function fullBoxTiming(buffer: Buffer, box: Mp4Box): { duration: number; timeScale: number } {
  const version = buffer[box.dataStart];
  if (version === 0) {
    if (box.dataEnd - box.dataStart < 20) throw new Error("MP4 version-zero timing box is truncated.");
    return {
      duration: buffer.readUInt32BE(box.dataStart + 16),
      timeScale: buffer.readUInt32BE(box.dataStart + 12)
    };
  }

  if (version === 1) {
    if (box.dataEnd - box.dataStart < 32) throw new Error("MP4 version-one timing box is truncated.");
    return {
      duration: readUint64(buffer, box.dataStart + 24),
      timeScale: buffer.readUInt32BE(box.dataStart + 20)
    };
  }

  throw new Error(`Unsupported MP4 full-box version ${version}.`);
}

function handlerType(buffer: Buffer, track: Mp4Box, budget: Mp4ParseBudget): string {
  const hdlr = childBox(buffer, childBox(buffer, track, "mdia", budget), "hdlr", budget);
  if (hdlr.dataEnd - hdlr.dataStart < 12) throw new Error("MP4 handler box is truncated.");
  return buffer.toString("ascii", hdlr.dataStart + 8, hdlr.dataStart + 12);
}

function sampleEntryType(buffer: Buffer, track: Mp4Box, budget: Mp4ParseBudget): string {
  const stbl = childBox(buffer, childBox(buffer, childBox(buffer, track, "mdia", budget), "minf", budget), "stbl", budget);
  const stsd = childBox(buffer, stbl, "stsd", budget);
  if (stsd.dataEnd - stsd.dataStart < 16) throw new Error("MP4 sample-description table is truncated.");
  const entryCount = buffer.readUInt32BE(stsd.dataStart + 4);
  if (entryCount !== 1) throw new Error("MP4 has an unexpected sample-description table.");
  return buffer.toString("ascii", stsd.dataStart + 12, stsd.dataStart + 16);
}

function trackDimensions(buffer: Buffer, track: Mp4Box, budget: Mp4ParseBudget): { height: number; width: number } {
  const tkhd = childBox(buffer, track, "tkhd", budget);
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
  if (Number(match[2]) >= 60 || Number(match[3]) >= 60) {
    throw new Error(`Out-of-range WebVTT timestamp: ${value}`);
  }
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

describe("CytoCV supplementary video assets", () => {
  it("locks the authorized self-hosted MP4 bytes and ISO media streams without requiring ffprobe", () => {
    const asset = readBoundedAsset(videoPath, maxVideoBytes, "MP4");
    const budget = { boxCount: 0 };
    const boxes = parseBoxes(asset, 0, asset.length, 0, budget);
    const movie = boxes.find((box) => box.type === "moov");
    const fileType = boxes.find((box) => box.type === "ftyp");

    expect(asset.length).toBe(14_938_147);
    expect(createHash("sha256").update(asset).digest("hex")).toBe(expectedVideoSha256);
    expect(fileType).toBeDefined();
    expect(asset.toString("ascii", fileType!.dataStart, fileType!.dataEnd)).toContain("isom");
    expect(movie).toBeDefined();

    const movieTiming = fullBoxTiming(asset, childBox(asset, movie!, "mvhd", budget));
    expect(movieTiming).toEqual({ duration: 328_440, timeScale: 1_000 });

    const tracks = parseBoxes(asset, movie!.dataStart, movie!.dataEnd, movie!.depth + 1, budget).filter(
      (box) => box.type === "trak"
    );
    const videoTrack = tracks.find((track) => handlerType(asset, track, budget) === "vide");
    const audioTrack = tracks.find((track) => handlerType(asset, track, budget) === "soun");

    expect(videoTrack).toBeDefined();
    expect(audioTrack).toBeDefined();
    expect(trackDimensions(asset, videoTrack!, budget)).toEqual({ height: 1108, width: 1710 });
    expect(sampleEntryType(asset, videoTrack!, budget)).toBe("avc1");
    expect(sampleEntryType(asset, audioTrack!, budget)).toBe("mp4a");
    expect(fullBoxTiming(asset, childBox(asset, childBox(asset, videoTrack!, "mdia", budget), "mdhd", budget))).toEqual({
      duration: 4_204_032,
      timeScale: 12_800
    });
    expect(fullBoxTiming(asset, childBox(asset, childBox(asset, audioTrack!, "mdia", budget), "mdhd", budget))).toEqual({
      duration: 15_764_537,
      timeScale: 48_000
    });
    expect(budget.boxCount).toBeLessThanOrEqual(maxMp4BoxCount);
  });

  it("rejects malformed ISO boxes before unbounded traversal", () => {
    const truncatedExtendedHeader = Buffer.from([0, 0, 0, 1, 102, 114, 101, 101]);
    const tooManyBoxes = Buffer.alloc((maxMp4BoxCount + 1) * 8);
    for (let offset = 0; offset < tooManyBoxes.length; offset += 8) {
      tooManyBoxes.writeUInt32BE(8, offset);
      tooManyBoxes.write("free", offset + 4, "ascii");
    }

    expect(() => parseBoxes(truncatedExtendedHeader)).toThrow("extended box header is truncated");
    expect(() => parseBoxes(tooManyBoxes)).toThrow("box count exceeds the ceiling");
    expect(() => parseBoxes(Buffer.alloc(8), 0, 8, maxMp4BoxDepth + 1)).toThrow("nesting exceeds the depth ceiling");
  });

  it("locks LF-only captions and the readable visual-description transcript to the narrated source timeline", () => {
    const captionsBytes = readBoundedAsset(captionsPath, maxCaptionsBytes, "WebVTT");
    const transcriptBytes = readBoundedAsset(transcriptPath, maxTranscriptBytes, "transcript");
    const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
    const captions = utf8Decoder.decode(captionsBytes);
    const transcript = utf8Decoder.decode(transcriptBytes);
    const cueMatches = [...captions.matchAll(/^(\d+)\n(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n([\s\S]*?)(?=\n\n\d+\n|\n*$)/gm)];

    expect(captionsBytes.includes(13)).toBe(false);
    expect(transcriptBytes.includes(13)).toBe(false);
    expect(createHash("sha256").update(captionsBytes).digest("hex")).toBe(expectedCaptionsSha256);
    expect(createHash("sha256").update(transcriptBytes).digest("hex")).toBe(expectedTranscriptSha256);
    expect(captions.startsWith("WEBVTT\n")).toBe(true);
    expect(cueMatches).toHaveLength(85);
    expect(cueMatches.map((cue) => cue[0].trimEnd()).join("\n\n")).toBe(
      captions.slice("WEBVTT\n\n".length).trimEnd()
    );

    let previousEnd = 0;
    for (const [index, cue] of cueMatches.entries()) {
      const start = parseTimestamp(cue[2]!);
      const end = parseTimestamp(cue[3]!);
      expect(cue[1]).toBe(String(index + 1));
      expect(start).toBeGreaterThanOrEqual(previousEnd);
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(328.44);
      expect(cue[4]?.trim()).toBeTruthy();
      previousEnd = end;
    }

    expect(cueMatches[0]?.[2]).toBe("00:00:00.430");
    expect(cueMatches.at(-1)?.[3]).toBe("00:05:27.380");
    expect(captions).toContain("00:02:16.860 --> 00:02:20.580");
    expect(captions).toContain("00:02:27.780 --> 00:02:29.370");
    expect(captions).toContain("large-budded cell pairs");
    expect(captions).toContain("CytoCV");
    expect(captions).toContain("DIC image");
    expect(transcript).toContain("CytoCV Supplementary Video S1");
    expect(transcript).toContain("nuclear versus cytoplasmic intensities");
    expect(transcript).toContain("Visual descriptions");
    expect(transcript).toContain("DAPI");
    expect(transcript).toContain("Nup2-mKATE");
    expect(transcript).toContain("Stu2-GFP");
    expect(transcript).toContain("CSV and Excel");
    expect(`${captions}\n${transcript}`).not.toMatch(/draft|uncertainty/i);
  });
});
