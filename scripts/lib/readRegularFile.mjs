import { constants } from "node:fs";
import { open } from "node:fs/promises";

// Keep type, size and byte reads on one descriptor. The caller owns the parent
// directory; this rejects a linked final entry without reopening its pathname.
export async function readRegularFile(pathname, { maximumBytes, minimumBytes = 0 }) {
  if (!Number.isSafeInteger(maximumBytes) || !Number.isSafeInteger(minimumBytes) || minimumBytes < 0 || maximumBytes < minimumBytes) {
    throw new Error("Regular-file byte limits are invalid.");
  }
  if (typeof constants.O_NOFOLLOW !== "number" || typeof constants.O_NONBLOCK !== "number") {
    throw new Error("This platform does not support the required regular-file open protections.");
  }
  const handle = await open(pathname, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < minimumBytes || before.size > maximumBytes) throw new Error("Input must be a regular file within its byte budget.");
    const chunks = [];
    const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, maximumBytes + 1));
    let total = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, maximumBytes + 1 - total), total);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maximumBytes) throw new Error("Input exceeds its byte budget.");
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    const after = await handle.stat();
    if (total !== before.size || total < minimumBytes || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) {
      throw new Error("Input changed while its bytes were being read.");
    }
    return Buffer.concat(chunks);
  } finally {
    await handle.close();
  }
}
