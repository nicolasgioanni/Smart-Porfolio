import { inflateSync } from "node:zlib";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Limits intentionally leave substantial headroom above the current research
 * abstracts while bounding the work performed on untrusted PNG uploads.
 */
export const pngParserLimits = Object.freeze({
  maxChunkCount: 4096,
  maxDecodedImageDataBytes: 64 * 1024 * 1024,
  maxDeclaredChunkDataBytes: 30 * 1024 * 1024,
  maxHeight: 16_384,
  maxInputBytes: 32 * 1024 * 1024,
  maxPixelCount: 64 * 1024 * 1024,
  maxWidth: 16_384
});

const validBitDepthsByColorType = Object.freeze({
  0: Object.freeze([1, 2, 4, 8, 16]),
  2: Object.freeze([8, 16]),
  3: Object.freeze([1, 2, 4, 8]),
  4: Object.freeze([8, 16]),
  6: Object.freeze([8, 16])
});

const channelCountByColorType = Object.freeze({
  0: 1,
  2: 3,
  3: 1,
  4: 2,
  6: 4
});

const adam7Passes = Object.freeze([
  Object.freeze({ columnStart: 0, columnStep: 8, rowStart: 0, rowStep: 8 }),
  Object.freeze({ columnStart: 4, columnStep: 8, rowStart: 0, rowStep: 8 }),
  Object.freeze({ columnStart: 0, columnStep: 4, rowStart: 4, rowStep: 8 }),
  Object.freeze({ columnStart: 2, columnStep: 4, rowStart: 0, rowStep: 4 }),
  Object.freeze({ columnStart: 0, columnStep: 2, rowStart: 2, rowStep: 4 }),
  Object.freeze({ columnStart: 1, columnStep: 2, rowStart: 0, rowStep: 2 }),
  Object.freeze({ columnStart: 0, columnStep: 1, rowStart: 1, rowStep: 2 })
]);

const knownCriticalChunkTypes = new Set(["IDAT", "IEND", "IHDR", "PLTE"]);

export const restrictedPngMetadataChunkTypes = new Set([
  "caBX",
  "eXIf",
  "iTXt",
  "tEXt",
  "zTXt"
]);

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function describeByteLimit(bytes) {
  return bytes % (1024 * 1024) === 0 ? `${bytes / (1024 * 1024)} MiB` : `${bytes} bytes`;
}

function resolveParserLimits(overrides) {
  if (overrides !== undefined && (overrides === null || typeof overrides !== "object" || Array.isArray(overrides))) {
    throw new TypeError("PNG parser limit overrides must be an object.");
  }

  for (const name of Object.keys(overrides ?? {})) {
    if (!Object.prototype.hasOwnProperty.call(pngParserLimits, name)) {
      throw new TypeError(`Unknown PNG parser limit ${name}.`);
    }
  }

  const limits = { ...pngParserLimits, ...overrides };

  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`PNG parser limit ${name} must be a positive safe integer.`);
    }
    if (value > pngParserLimits[name]) {
      throw new RangeError(`PNG parser limit ${name} cannot exceed its protected default.`);
    }
  }

  if (limits.maxDeclaredChunkDataBytes > limits.maxInputBytes) {
    throw new RangeError("PNG parser maxDeclaredChunkDataBytes cannot exceed maxInputBytes.");
  }

  return limits;
}

function assertPngBuffer(value, limits) {
  if (!Buffer.isBuffer(value)) throw new TypeError("PNG input must be a Buffer.");
  if (value.length > limits.maxInputBytes) {
    throw new Error(`PNG input exceeds the ${describeByteLimit(limits.maxInputBytes)} limit.`);
  }
  if (value.length < pngSignature.length || !value.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error("Invalid PNG signature.");
  }
}

function parseIhdr(data, limits) {
  const width = data.readUInt32BE(0);
  const height = data.readUInt32BE(4);
  const bitDepth = data.readUInt8(8);
  const colorType = data.readUInt8(9);
  const compressionMethod = data.readUInt8(10);
  const filterMethod = data.readUInt8(11);
  const interlaceMethod = data.readUInt8(12);

  if (width === 0 || height === 0) throw new Error("PNG IHDR dimensions must be non-zero.");
  if (width > limits.maxWidth) throw new Error(`PNG width exceeds the ${limits.maxWidth}-pixel limit.`);
  if (height > limits.maxHeight) throw new Error(`PNG height exceeds the ${limits.maxHeight}-pixel limit.`);
  if (width * height > limits.maxPixelCount) {
    throw new Error(`PNG canvas exceeds the ${limits.maxPixelCount}-pixel limit.`);
  }

  const validBitDepths = validBitDepthsByColorType[colorType];
  if (!validBitDepths || !validBitDepths.includes(bitDepth)) {
    throw new Error(`PNG IHDR color type ${colorType} does not support bit depth ${bitDepth}.`);
  }
  if (compressionMethod !== 0) throw new Error("PNG IHDR compression method must be 0.");
  if (filterMethod !== 0) throw new Error("PNG IHDR filter method must be 0.");
  if (interlaceMethod !== 0 && interlaceMethod !== 1) {
    throw new Error("PNG IHDR interlace method must be 0 or 1.");
  }

  return { bitDepth, colorType, height, interlaceMethod, width };
}

function adam7Dimension(size, start, step) {
  return size <= start ? 0 : Math.floor((size - start + step - 1) / step);
}

function getImageScanlineLayout({ bitDepth, colorType, height, interlaceMethod, width }) {
  const bitsPerPixel = channelCountByColorType[colorType] * bitDepth;
  const rawPasses =
    interlaceMethod === 0
      ? [{ height, width }]
      : adam7Passes.map(({ columnStart, columnStep, rowStart, rowStep }) => ({
          height: adam7Dimension(height, rowStart, rowStep),
          width: adam7Dimension(width, columnStart, columnStep)
        }));
  const passes = rawPasses
    .filter(({ height: passHeight, width: passWidth }) => passHeight > 0 && passWidth > 0)
    .map(({ height: passHeight, width: passWidth }) => ({
      height: passHeight,
      scanlineBytes: Math.ceil((passWidth * bitsPerPixel) / 8)
    }));
  const decodedByteLength = passes.reduce(
    (total, { height: passHeight, scanlineBytes }) => total + passHeight * (scanlineBytes + 1),
    0
  );

  return { decodedByteLength, passes };
}

function validateImageData(idatChunks, ihdr, limits) {
  const { decodedByteLength, passes } = getImageScanlineLayout(ihdr);
  if (decodedByteLength > limits.maxDecodedImageDataBytes) {
    throw new Error(
      `PNG decoded image data exceeds the ${describeByteLimit(limits.maxDecodedImageDataBytes)} limit.`
    );
  }

  const idatStream = Buffer.concat(idatChunks);
  let inflated;
  try {
    inflated = inflateSync(idatStream, {
      info: true,
      maxOutputLength: Math.min(limits.maxDecodedImageDataBytes, decodedByteLength + 1)
    });
  } catch {
    throw new Error("PNG IDAT data is not a valid bounded zlib stream.");
  }

  if (inflated.engine.bytesWritten !== idatStream.length) {
    throw new Error("PNG IDAT data contains trailing bytes after its zlib stream.");
  }
  if (inflated.buffer.length !== decodedByteLength) {
    throw new Error("PNG IDAT decompressed data length does not match IHDR scanlines.");
  }

  let offset = 0;
  for (const { height, scanlineBytes } of passes) {
    for (let row = 0; row < height; row += 1) {
      if (inflated.buffer[offset] > 4) {
        throw new Error("PNG IDAT scanlines must use filter bytes from 0 through 4.");
      }
      offset += scanlineBytes + 1;
    }
  }
}

export function parsePng(buffer, limitOverrides) {
  const limits = resolveParserLimits(limitOverrides);
  assertPngBuffer(buffer, limits);

  const chunks = [];
  let declaredChunkDataBytes = 0;
  let dimensions;
  let idatDataBytes = 0;
  const idatChunks = [];
  let offset = pngSignature.length;
  let sawIdat = false;
  let endedIdatSequence = false;
  let sawIend = false;
  let sawPlte = false;

  while (offset < buffer.length) {
    if (chunks.length >= limits.maxChunkCount) {
      throw new Error(`PNG exceeds the ${limits.maxChunkCount}-chunk limit.`);
    }
    if (buffer.length - offset < 12) throw new Error("Truncated PNG chunk header.");

    const length = buffer.readUInt32BE(offset);
    if (length > buffer.length - offset - 12) throw new Error("PNG chunk length exceeds the available bytes.");
    if (length > limits.maxDeclaredChunkDataBytes - declaredChunkDataBytes) {
      throw new Error(
        `PNG declared chunk data exceeds the ${describeByteLimit(limits.maxDeclaredChunkDataBytes)} limit.`
      );
    }

    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    const data = buffer.subarray(dataStart, dataEnd);
    const typeBytes = buffer.subarray(typeStart, dataStart);
    const type = typeBytes.toString("ascii");

    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("PNG chunk type must contain four ASCII letters.");

    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = crc32(buffer.subarray(typeStart, dataEnd));
    if (actualCrc !== expectedCrc) throw new Error(`PNG chunk ${type} has an invalid CRC.`);

    if (chunks.length === 0) {
      if (type !== "IHDR" || length !== 13) throw new Error("PNG must begin with one 13-byte IHDR chunk.");
      dimensions = parseIhdr(data, limits);
    } else if (type === "IHDR") {
      throw new Error("PNG must contain exactly one IHDR chunk.");
    }

    if (/^[A-Z]/.test(type) && !knownCriticalChunkTypes.has(type)) {
      throw new Error(`PNG contains unknown critical chunk ${type}.`);
    }

    if (type === "PLTE") {
      if (sawPlte) throw new Error("PNG must contain at most one PLTE chunk.");
      if (sawIdat) throw new Error("PNG PLTE chunk must precede IDAT chunks.");
      if (dimensions.colorType === 0 || dimensions.colorType === 4) {
        throw new Error("PNG PLTE chunk is prohibited for grayscale color types.");
      }
      if (length === 0 || length % 3 !== 0) {
        throw new Error("PNG PLTE chunk must have a non-zero length divisible by 3.");
      }

      const paletteEntries = length / 3;
      if (paletteEntries > 256) throw new Error("PNG PLTE chunk cannot contain more than 256 entries.");
      if (dimensions.colorType === 3 && paletteEntries > 2 ** dimensions.bitDepth) {
        throw new Error("PNG indexed-color PLTE entries exceed the IHDR bit depth.");
      }
      sawPlte = true;
    }

    if (type === "IDAT") {
      if (endedIdatSequence) throw new Error("PNG IDAT chunks must be consecutive.");
      if (dimensions.colorType === 3 && !sawPlte) {
        throw new Error("PNG indexed-color images require one PLTE chunk before IDAT.");
      }
      sawIdat = true;
      idatDataBytes += length;
      idatChunks.push(data);
    } else if (sawIdat && type !== "IEND") {
      endedIdatSequence = true;
    }

    if (type === "IEND") {
      if (length !== 0) throw new Error("PNG IEND chunk must be empty.");
      if (!sawIdat) throw new Error("PNG must contain at least one IDAT chunk.");
      if (idatDataBytes === 0) throw new Error("PNG must contain non-empty IDAT data.");
      if (chunkEnd !== buffer.length) throw new Error("PNG contains trailing bytes after IEND.");
      sawIend = true;
    }

    chunks.push({
      data,
      length,
      raw: buffer.subarray(offset, chunkEnd),
      type
    });
    declaredChunkDataBytes += length;
    offset = chunkEnd;

    if (sawIend) break;
  }

  if (!sawIend) throw new Error("PNG is missing its terminal IEND chunk.");
  validateImageData(idatChunks, dimensions, limits);

  return {
    chunks,
    height: dimensions.height,
    width: dimensions.width
  };
}

export function stripPngMetadata(buffer) {
  const parsed = parsePng(buffer);
  const removedTypes = [];
  const retainedChunks = [];

  for (const chunk of parsed.chunks) {
    if (restrictedPngMetadataChunkTypes.has(chunk.type)) {
      removedTypes.push(chunk.type);
    } else {
      retainedChunks.push(chunk.raw);
    }
  }

  const sanitized = Buffer.concat([pngSignature, ...retainedChunks]);
  parsePng(sanitized);

  return {
    buffer: sanitized,
    height: parsed.height,
    removedTypes,
    width: parsed.width
  };
}
