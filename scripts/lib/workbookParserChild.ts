import { parsePortfolioWorkbookInChild } from "./portfolioContentGeneration";
import { safeWorkbookParserError } from "./workbookParserProcess";

async function main() {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > 5 * 1024 * 1024) throw new Error("Input limit exceeded");
    chunks.push(buffer);
  }
  const sheets = await parsePortfolioWorkbookInChild(Buffer.concat(chunks));
  process.stdout.write(JSON.stringify({ sheets }));
}
main().catch((error: unknown) => {
  process.stdout.write(JSON.stringify({ error: safeWorkbookParserError(error instanceof Error ? error.message : "") }));
});
