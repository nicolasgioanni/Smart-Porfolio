import { constants } from "node:fs";
import { open, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const maximumPayloadBytes = 100 * 1024 * 1024;

async function writeFromStandardInput(destination) {
  if (process.argv.length !== 3 || !path.isAbsolute(destination) || path.resolve(destination) === path.parse(path.resolve(destination)).root) {
    throw new Error("Pinned payload destination is invalid.");
  }

  let completed = false;
  const handle = await open(
    destination,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
    0o600
  );
  try {
    let bytesWritten = 0;
    for await (const chunk of process.stdin) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytesWritten += bytes.length;
      if (bytesWritten > maximumPayloadBytes) throw new Error("Pinned payload exceeds its size budget.");
      await handle.write(bytes);
    }
    if (bytesWritten === 0) throw new Error("Pinned payload is empty.");
    completed = true;
  } finally {
    await handle.close();
    if (!completed) await rm(destination, { force: true });
  }
}

const destination = process.argv[2];
writeFromStandardInput(destination).catch(() => {
  process.exitCode = 1;
});
