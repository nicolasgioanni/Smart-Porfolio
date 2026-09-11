import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  parsePng,
  pngParserLimits,
  restrictedPngMetadataChunkTypes,
  stripPngMetadata
} from "./lib/pngMetadata.mjs";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const channelCountByColorType = Object.freeze({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 });
const adam7Passes = Object.freeze([
  Object.freeze({ columnStart: 0, columnStep: 8, rowStart: 0, rowStep: 8 }),
  Object.freeze({ columnStart: 4, columnStep: 8, rowStart: 0, rowStep: 8 }),
  Object.freeze({ columnStart: 0, columnStep: 4, rowStart: 4, rowStep: 8 }),
  Object.freeze({ columnStart: 2, columnStep: 4, rowStart: 0, rowStep: 4 }),
  Object.freeze({ columnStart: 0, columnStep: 2, rowStart: 2, rowStep: 4 }),
  Object.freeze({ columnStart: 1, columnStep: 2, rowStart: 0, rowStep: 2 }),
  Object.freeze({ columnStart: 0, columnStep: 1, rowStart: 1, rowStep: 2 })
]);
const cytocvAssetPath = path.join(
  process.cwd(),
  "public",
  "images",
  "research",
  "cytocv-graphical-abstract.png"
);
const stripPngMetadataScript = path.join(process.cwd(), "scripts", "stripPngMetadata.mjs");

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

function ihdr(
  width = 1,
  height = 1,
  { bitDepth = 8, colorType = 6, compressionMethod = 0, filterMethod = 0, interlaceMethod = 0 } = {}
) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.set([bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod], 8);
  return chunk("IHDR", data);
}

function adam7Dimension(size, start, step) {
  return size <= start ? 0 : Math.floor((size - start + step - 1) / step);
}

function createScanlineData(width, height, { bitDepth = 8, colorType = 6, interlaceMethod = 0 } = {}) {
  const bitsPerPixel = (channelCountByColorType[colorType] ?? 1) * bitDepth;
  const passes =
    interlaceMethod === 0
      ? [{ height, width }]
      : adam7Passes.map(({ columnStart, columnStep, rowStart, rowStep }) => ({
          height: adam7Dimension(height, rowStart, rowStep),
          width: adam7Dimension(width, columnStart, columnStep)
        }));
  const scanlines = [];

  for (const { height: passHeight, width: passWidth } of passes) {
    if (passHeight === 0 || passWidth === 0) continue;
    const scanline = Buffer.alloc(Math.ceil((passWidth * bitsPerPixel) / 8) + 1);
    for (let row = 0; row < passHeight; row += 1) scanlines.push(scanline);
  }

  return Buffer.concat(scanlines);
}

function validSyntheticPng(extraChunks = [], options = {}) {
  const {
    bitDepth = 8,
    colorType = 6,
    compressionMethod = 0,
    filterMethod = 0,
    height = 1,
    includePlte = colorType === 3,
    interlaceMethod = 0,
    plteData = Buffer.from([0, 0, 0]),
    uncompressedData,
    width = 1
  } = options;
  const imageData = uncompressedData ?? createScanlineData(width, height, { bitDepth, colorType, interlaceMethod });

  return Buffer.concat([
    signature,
    ihdr(width, height, { bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod }),
    ...extraChunks,
    ...(includePlte ? [chunk("PLTE", plteData)] : []),
    chunk("IDAT", deflateSync(imageData)),
    chunk("IEND")
  ]);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("PNG metadata handling", () => {
  it("removes only restricted ancillary chunks without rewriting retained bytes", () => {
    const restrictedChunks = [...restrictedPngMetadataChunkTypes].map((type) =>
      chunk(type, Buffer.from(`metadata:${type}`, "utf8"))
    );
    const source = validSyntheticPng([chunk("pHYs", Buffer.alloc(9)), ...restrictedChunks]);
    const sourcePng = parsePng(source);
    const result = stripPngMetadata(source);
    const sanitizedPng = parsePng(result.buffer);

    expect(result).toMatchObject({ height: 1, width: 1 });
    expect(result.removedTypes.sort()).toEqual([...restrictedPngMetadataChunkTypes].sort());
    expect(sanitizedPng.chunks.map(({ type }) => type)).toEqual(["IHDR", "pHYs", "IDAT", "IEND"]);

    const retainedSourceBytes = sourcePng.chunks
      .filter(({ type }) => !restrictedPngMetadataChunkTypes.has(type))
      .map(({ raw }) => raw);
    expect(Buffer.concat(sanitizedPng.chunks.map(({ raw }) => raw))).toEqual(Buffer.concat(retainedSourceBytes));
  });

  it("locks the sanitized CytoCV dimensions, file hash, and compressed pixel stream", () => {
    const image = readFileSync(cytocvAssetPath);
    const parsed = parsePng(image);
    const idatStream = Buffer.concat(parsed.chunks.filter(({ type }) => type === "IDAT").map(({ data }) => data));

    expect(parsed).toMatchObject({ height: 941, width: 1672 });
    expect(image.length).toBe(1_525_043);
    expect(sha256(image)).toBe("e6125dd48bf499550aa079a3553780feea1cda74c318b5334e0b0b2df67209a6");
    expect(sha256(idatStream)).toBe("9c6993184e4f8638919f3e822b31cdec6b1e84d9a12b9fe1545b1a1eb5fb86b7");
    expect(parsed.chunks.some(({ type }) => restrictedPngMetadataChunkTypes.has(type))).toBe(false);
  });

  it("rejects malformed signatures, boundaries, checksums, and terminal structure", () => {
    const valid = validSyntheticPng();

    expect(() => parsePng(Buffer.alloc(8))).toThrow(/signature/i);
    expect(() => parsePng(valid.subarray(0, 11))).toThrow(/truncated/i);

    const lengthOverrun = Buffer.from(valid);
    lengthOverrun.writeUInt32BE(0xffffffff, 8);
    expect(() => parsePng(lengthOverrun)).toThrow(/length exceeds/i);

    const badCrc = Buffer.from(valid);
    badCrc[24] ^= 1;
    expect(() => parsePng(badCrc)).toThrow(/invalid CRC/i);

    expect(() => parsePng(valid.subarray(0, -12))).toThrow(/IEND/i);
    expect(() => parsePng(Buffer.concat([signature, ihdr(), chunk("IDAT", Buffer.from([1])), chunk("IEND", Buffer.from([0]))]))).toThrow(/IEND chunk must be empty/i);
    expect(() => parsePng(Buffer.concat([valid, Buffer.from([0])]))).toThrow(/trailing bytes/i);
  });

  it("rejects duplicate or misplaced headers and images without pixel data", () => {
    const idat = chunk("IDAT", Buffer.from([1]));
    const iend = chunk("IEND");

    expect(() => parsePng(Buffer.concat([signature, chunk("IHDR", Buffer.alloc(12)), idat, iend]))).toThrow(
      /begin with one 13-byte IHDR/i
    );
    expect(() => parsePng(Buffer.concat([signature, ihdr(), ihdr(), idat, iend]))).toThrow(/exactly one IHDR/i);
    expect(() => parsePng(Buffer.concat([signature, idat, ihdr(), iend]))).toThrow(/begin with one 13-byte IHDR/i);
    expect(() => parsePng(Buffer.concat([signature, ihdr(), iend]))).toThrow(/at least one IDAT/i);
    expect(() => parsePng(Buffer.concat([signature, ihdr(), chunk("IDAT"), iend]))).toThrow(/non-empty IDAT/i);
    expect(() =>
      parsePng(Buffer.concat([signature, ihdr(), idat, chunk("tEXt"), idat, iend]))
    ).toThrow(/IDAT chunks must be consecutive/i);
  });

  it("does not produce sanitized output for CRC-valid malformed IHDR or IDAT chunks", () => {
    const iend = chunk("IEND");
    const malformedHeaders = [
      Buffer.concat([signature, ihdr(0, 1), chunk("IDAT", Buffer.from([1])), iend]),
      Buffer.concat([
        signature,
        ihdr(pngParserLimits.maxWidth + 1, 1),
        chunk("IDAT", Buffer.from([1])),
        iend
      ]),
      Buffer.concat([signature, ihdr(1, 1, { colorType: 1 }), chunk("IDAT", Buffer.from([1])), iend]),
      Buffer.concat([signature, ihdr(), chunk("IDAT"), iend]),
      Buffer.concat([signature, ihdr(), chunk("IDAT", Buffer.from([0, 1, 2])), iend]),
      validSyntheticPng([], { bitDepth: 1, colorType: 3, includePlte: false })
    ];

    for (const malformed of malformedHeaders) {
      expect(() => stripPngMetadata(malformed)).toThrow();
    }
  });

  it("validates bounded zlib scanlines, including Adam7 passes", () => {
    const iend = chunk("IEND");
    const validRawData = createScanlineData(1, 1);
    const invalidFilterData = Buffer.from(validRawData);
    invalidFilterData[0] = 5;
    const invalidAdam7FilterData = createScanlineData(5, 5, { interlaceMethod: 1 });
    invalidAdam7FilterData[5] = 5;

    expect(() => parsePng(Buffer.concat([signature, ihdr(), chunk("IDAT", Buffer.from([0, 1, 2])), iend]))).toThrow(
      /valid bounded zlib stream/i
    );
    expect(() =>
      parsePng(
        Buffer.concat([
          signature,
          ihdr(),
          chunk("IDAT", Buffer.concat([deflateSync(validRawData), Buffer.from([0])])),
          iend
        ])
      )
    ).toThrow(/trailing bytes after its zlib stream/i);
    expect(() => parsePng(validSyntheticPng([], { uncompressedData: Buffer.alloc(4) }))).toThrow(
      /decompressed data length/i
    );
    expect(() => parsePng(validSyntheticPng([], { uncompressedData: invalidFilterData }))).toThrow(
      /filter bytes from 0 through 4/i
    );
    expect(() => parsePng(validSyntheticPng([], { height: 5, interlaceMethod: 1, width: 5 }))).not.toThrow();
    expect(() =>
      parsePng(
        validSyntheticPng([], {
          height: 5,
          interlaceMethod: 1,
          uncompressedData: invalidAdam7FilterData,
          width: 5
        })
      )
    ).toThrow(/filter bytes from 0 through 4/i);
    expect(() => parsePng(validSyntheticPng([], { width: 2 }), { maxDecodedImageDataBytes: 8 })).toThrow(
      /decoded image data exceeds the 8 bytes limit/i
    );
    expect(() =>
      parsePng(
        Buffer.concat([
          signature,
          ihdr(8192, 8192, { bitDepth: 16, colorType: 6 }),
          chunk("IDAT", Buffer.from([1])),
          iend
        ])
      )
    ).toThrow(/decoded image data exceeds the 64 MiB limit/i);
  });

  it("enforces PNG palette and critical chunk semantics", () => {
    const indexed = { bitDepth: 1, colorType: 3, includePlte: false };
    const truecolorRawData = createScanlineData(1, 1, { colorType: 2 });
    const truecolorWithLatePalette = Buffer.concat([
      signature,
      ihdr(1, 1, { colorType: 2 }),
      chunk("IDAT", deflateSync(truecolorRawData)),
      chunk("PLTE", Buffer.from([0, 0, 0])),
      chunk("IEND")
    ]);

    expect(() => parsePng(validSyntheticPng([], indexed))).toThrow(/require one PLTE chunk before IDAT/i);
    expect(() =>
      parsePng(validSyntheticPng([chunk("PLTE")], indexed))
    ).toThrow(/non-zero length divisible by 3/i);
    expect(() =>
      parsePng(validSyntheticPng([chunk("PLTE", Buffer.alloc(9))], indexed))
    ).toThrow(/entries exceed the IHDR bit depth/i);
    expect(() => parsePng(truecolorWithLatePalette)).toThrow(/PLTE chunk must precede IDAT/i);
    expect(() =>
      parsePng(
        validSyntheticPng([chunk("PLTE", Buffer.from([0, 0, 0]))], {
          colorType: 2,
          includePlte: true
        })
      )
    ).toThrow(/at most one PLTE chunk/i);
    expect(() =>
      parsePng(
        validSyntheticPng([chunk("PLTE", Buffer.from([0, 0, 0]))], {
          colorType: 0,
          includePlte: false
        })
      )
    ).toThrow(/prohibited for grayscale/i);
    expect(() => parsePng(validSyntheticPng([chunk("ABCD")]))).toThrow(/unknown critical chunk ABCD/i);
    expect(() => parsePng(validSyntheticPng([], { colorType: 2, includePlte: true }))).not.toThrow();
  });

  it("accepts every PNG color-type and bit-depth combination allowed by IHDR", () => {
    const validBitDepthsByColorType = {
      0: [1, 2, 4, 8, 16],
      2: [8, 16],
      3: [1, 2, 4, 8],
      4: [8, 16],
      6: [8, 16]
    };

    for (const [colorType, bitDepths] of Object.entries(validBitDepthsByColorType)) {
      for (const bitDepth of bitDepths) {
        expect(() =>
          parsePng(validSyntheticPng([], { bitDepth, colorType: Number(colorType) }))
        ).not.toThrow();
      }
    }
  });

  it("rejects invalid IHDR color, depth, compression, filter, and interlace fields", () => {
    const invalidColorAndDepthPairs = [
      { bitDepth: 3, colorType: 0 },
      { bitDepth: 4, colorType: 2 },
      { bitDepth: 16, colorType: 3 },
      { bitDepth: 4, colorType: 4 },
      { bitDepth: 4, colorType: 6 },
      { bitDepth: 8, colorType: 1 }
    ];

    for (const fields of invalidColorAndDepthPairs) {
      expect(() => parsePng(validSyntheticPng([], fields))).toThrow(/color type .* bit depth/i);
    }

    expect(() => parsePng(validSyntheticPng([], { compressionMethod: 1 }))).toThrow(/compression method must be 0/i);
    expect(() => parsePng(validSyntheticPng([], { filterMethod: 1 }))).toThrow(/filter method must be 0/i);
    expect(() => parsePng(validSyntheticPng([], { interlaceMethod: 2 }))).toThrow(/interlace method must be 0 or 1/i);
  });

  it("bounds IHDR dimensions and total pixel count", () => {
    const onePixel = chunk("IDAT", Buffer.from([1]));
    const iend = chunk("IEND");
    const pngWithDimensions = (width, height) => Buffer.concat([signature, ihdr(width, height), onePixel, iend]);
    const canvasOverflowHeight = Math.floor(pngParserLimits.maxPixelCount / pngParserLimits.maxWidth) + 1;

    expect(() => parsePng(pngWithDimensions(0, 1))).toThrow(/dimensions must be non-zero/i);
    expect(() => parsePng(pngWithDimensions(1, 0))).toThrow(/dimensions must be non-zero/i);
    expect(() => parsePng(pngWithDimensions(pngParserLimits.maxWidth + 1, 1))).toThrow(/width exceeds/i);
    expect(() => parsePng(pngWithDimensions(1, pngParserLimits.maxHeight + 1))).toThrow(/height exceeds/i);
    expect(canvasOverflowHeight).toBeLessThanOrEqual(pngParserLimits.maxHeight);
    expect(() => parsePng(pngWithDimensions(pngParserLimits.maxWidth, canvasOverflowHeight))).toThrow(
      /canvas exceeds/i
    );
  });

  it("bounds PNG input bytes before inspecting the signature", () => {
    const oversized = Buffer.alloc(pngParserLimits.maxInputBytes + 1);

    expect(() => parsePng(oversized)).toThrow(new RegExp(`${pngParserLimits.maxInputBytes / (1024 * 1024)} MiB limit`, "i"));
  });

  it("rejects an oversized file from stat before reading or creating an output", () => {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "png-metadata-test-"));
    const inputPath = path.join(temporaryDirectory, "oversized.png");
    const outputPath = path.join(temporaryDirectory, "sanitized.png");

    try {
      writeFileSync(inputPath, Buffer.alloc(0));
      truncateSync(inputPath, pngParserLimits.maxInputBytes + 1);

      const result = spawnSync(process.execPath, [stripPngMetadataScript, inputPath, outputPath], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`${pngParserLimits.maxInputBytes / (1024 * 1024)} MiB limit`, "i"));
      expect(existsSync(outputPath)).toBe(false);
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("bounds chunk count and aggregate declared chunk data before expensive parsing work", () => {
    const tooManyChunks = validSyntheticPng(
      Array.from({ length: pngParserLimits.maxChunkCount }, () => chunk("tEXt"))
    );
    const aggregateData = validSyntheticPng([chunk("tEXt", Buffer.alloc(12))]);

    expect(() => parsePng(tooManyChunks)).toThrow(new RegExp(`${pngParserLimits.maxChunkCount}-chunk limit`, "i"));
    expect(() => parsePng(aggregateData, {
      maxChunkCount: 16,
      maxDeclaredChunkDataBytes: 10,
      maxInputBytes: 1024
    })).toThrow(/declared chunk data exceeds the 10 bytes limit/i);
  });

  it("allows only known, lower parser limits so callers cannot bypass the resource ceiling", () => {
    const valid = validSyntheticPng();

    for (const limitName of Object.keys(pngParserLimits)) {
      expect(() => parsePng(valid, { [limitName]: pngParserLimits[limitName] + 1 })).toThrow(
        new RegExp(`${limitName} cannot exceed its protected default`, "i")
      );
    }
    expect(() =>
      parsePng(Buffer.concat([signature, ihdr(2, 1), chunk("IDAT", Buffer.from([1])), chunk("IEND")]), {
        maxWidth: 1
      })
    ).toThrow(/width exceeds the 1-pixel limit/i);
    expect(() => parsePng(valid, { unknownLimit: 1 })).toThrow(/unknown PNG parser limit unknownLimit/i);
    expect(() => parsePng(valid, null)).toThrow(/limit overrides must be an object/i);
  });
});
