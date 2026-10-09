export const defaultStaticExportDirectory: string;
export const cloudflareHeaderLineLimit: number;
export const cloudflareHeaderRuleLimit: number;

export function createStaticScriptHash(scriptContent: string): string;
export function extractInlineScriptContents(html: string): string[];
export function extractInlineScriptHashes(html: string): string[];
export function createStaticContentSecurityPolicy(scriptHashes: string[]): string;
export function assertCloudflareHeaderLimits(headerFile: string): void;
export function writeStaticResponseHeaders(
  exportDirectory?: string
): Promise<{ htmlFileCount: number; ruleCount: number }>;
