import JSZip, { type JSZipObject } from "jszip";

export const portfolioWorkbookMaxArchiveEntries = 128;
export const portfolioWorkbookMaxDecodedBytesPerArchiveEntry = 16 * 1024 * 1024;
export const portfolioWorkbookMaxDecodedArchiveBytes = 32 * 1024 * 1024;

export function invalidXlsxWorkbookError(): Error {
  return new Error("The workbook download is not a valid XLSX workbook");
}

function decodedArchiveSizeLimitError(): Error {
  return new Error("The XLSX workbook archive exceeds the allowed decoded size limit");
}

function archiveEntryCountLimitError(): Error {
  return new Error("The XLSX workbook archive contains too many entries");
}

type ArchiveEntryStream = Pick<JSZip.JSZipStreamHelper<Uint8Array>, "on" | "pause" | "resume">;
// JSZip 3.10.1 provides internalStream() at runtime but omits it from JSZipObject's declarations.
// The dependency-boundary test pins that version, and archive tests exercise this capability.
type StreamingZipEntry = JSZipObject & {
  internalStream(type: "uint8array"): ArchiveEntryStream;
};

function decodedEntryByteLength(entry: JSZipObject, maximumBytes: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const stream = (entry as StreamingZipEntry).internalStream("uint8array");
    let decodedBytes = 0;
    let completed = false;

    const finish = (result: { bytes: number } | { error: Error }) => {
      if (completed) return;
      completed = true;

      if ("error" in result) {
        reject(result.error);
      } else {
        resolve(result.bytes);
      }
    };

    stream.on("error", () => {
      finish({ error: invalidXlsxWorkbookError() });
    });
    stream.on("end", () => {
      finish({ bytes: decodedBytes });
    });
    stream.on("data", (chunk: Uint8Array) => {
      if (completed) return;

      decodedBytes += chunk.byteLength;
      if (decodedBytes > maximumBytes) {
        stream.pause();
        finish({ error: decodedArchiveSizeLimitError() });
      }
    });
    stream.resume();
  });
}

export async function validatePortfolioWorkbookArchive(bytes: Uint8Array): Promise<void> {
  let archive: JSZip;

  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false });
  } catch {
    throw invalidXlsxWorkbookError();
  }

  const entries = Object.values(archive.files);
  if (entries.length > portfolioWorkbookMaxArchiveEntries) {
    throw archiveEntryCountLimitError();
  }

  let decodedArchiveBytes = 0;
  for (const entry of entries) {
    if (entry.dir) continue;

    const availableArchiveBytes = portfolioWorkbookMaxDecodedArchiveBytes - decodedArchiveBytes;
    const maximumEntryBytes = Math.min(portfolioWorkbookMaxDecodedBytesPerArchiveEntry, availableArchiveBytes);
    const decodedEntryBytes = await decodedEntryByteLength(entry, maximumEntryBytes);
    decodedArchiveBytes += decodedEntryBytes;
  }
}
