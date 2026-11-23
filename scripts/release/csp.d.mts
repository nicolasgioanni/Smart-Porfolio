export const pagesHeaderLimit: number;
export const pagesHeaderRuleLimit: number;
export function inlineScriptSources(html: string): string[];
export function hashesForInlineScripts(html: string): string[];
export function cspForHashes(hashes: string[]): string;
export function createStaticCsp(outDirectory: string): Promise<{
  routes: Record<string, string>;
  headers: string;
}>;
