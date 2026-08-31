import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pngParserLimits, stripPngMetadata } from "./lib/pngMetadata.mjs";

function comparablePath(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function main() {
  const [inputPath, outputPath, ...extraArguments] = process.argv.slice(2);
  if (!inputPath || !outputPath || extraArguments.length > 0) {
    throw new Error("Usage: node scripts/stripPngMetadata.mjs <input.png> <output.png>");
  }
  if (comparablePath(inputPath) === comparablePath(outputPath)) {
    throw new Error("Input and output paths must be different.");
  }

  const inputStat = await stat(inputPath);
  if (!inputStat.isFile()) throw new Error("PNG input must be a file.");
  if (inputStat.size > pngParserLimits.maxInputBytes) {
    throw new Error(`PNG input exceeds the ${pngParserLimits.maxInputBytes / (1024 * 1024)} MiB limit.`);
  }

  const source = await readFile(inputPath);
  const result = stripPngMetadata(source);
  await writeFile(outputPath, result.buffer, { flag: "wx" });

  const uniqueRemovedTypes = [...new Set(result.removedTypes)];
  process.stdout.write(
    `${JSON.stringify({
      height: result.height,
      outputBytes: result.buffer.length,
      removedChunks: result.removedTypes.length,
      removedTypes: uniqueRemovedTypes,
      sourceBytes: source.length,
      width: result.width
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
