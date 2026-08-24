import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import type { ContentSourceMode, GeneratedContentMetadata } from "../src/content/types";
import { parseCsv } from "../src/lib/csv/parseCsv";
import type { PortfolioSheetName, RawPortfolioSheets } from "../src/lib/content/normalizePortfolioContent";
import { normalizePortfolioContent } from "../src/lib/content/normalizePortfolioContent";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDirectory = path.join(projectRoot, "src", "content", "templates");
const outputPath = path.join(projectRoot, "src", "content", "generated", "portfolio.generated.json");
const localEnvPath = path.join(projectRoot, ".env");

if (existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}

const sheetConfigs: Array<{ name: PortfolioSheetName; fileName: string; envName?: string }> = [
  { name: "profile", fileName: "profile.csv", envName: "PORTFOLIO_PROFILE_CSV_URL" },
  { name: "links", fileName: "links.csv", envName: "PORTFOLIO_LINKS_CSV_URL" },
  { name: "research", fileName: "research.csv", envName: "PORTFOLIO_RESEARCH_CSV_URL" },
  { name: "projects", fileName: "projects.csv", envName: "PORTFOLIO_PROJECTS_CSV_URL" },
  { name: "experience", fileName: "experience.csv", envName: "PORTFOLIO_EXPERIENCE_CSV_URL" },
  { name: "recommendations", fileName: "recommendations.csv", envName: "PORTFOLIO_RECOMMENDATIONS_CSV_URL" },
  { name: "education", fileName: "education.csv", envName: "PORTFOLIO_EDUCATION_CSV_URL" },
  { name: "skills", fileName: "skills.csv", envName: "PORTFOLIO_SKILLS_CSV_URL" },
  { name: "resume", fileName: "resume.csv" },
  { name: "site_settings", fileName: "site_settings.csv", envName: "PORTFOLIO_SITE_SETTINGS_CSV_URL" }
];

async function readRemoteCsv(url: string, sheetName: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${sheetName} CSV from ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function readTemplateCsv(fileName: string): Promise<string> {
  return readFile(path.join(templateDirectory, fileName), "utf8");
}

function resolveSourceMode(sources: Record<string, "template" | "remote">): ContentSourceMode {
  const sourceValues = Object.values(sources);
  const remoteCount = sourceValues.filter((source) => source === "remote").length;

  if (remoteCount === 0) return "templates";
  if (remoteCount === sourceValues.length) return "remote";

  return "mixed";
}

async function main(): Promise<void> {
  const requireRemoteContent = process.env.PORTFOLIO_REQUIRE_REMOTE_CONTENT === "true";
  const sheets = {} as RawPortfolioSheets;
  const sources: Record<string, "template" | "remote"> = {};
  const missingRemoteEnvironmentVariables: string[] = [];

  for (const config of sheetConfigs) {
    const csvUrl = config.envName ? process.env[config.envName]?.trim() : undefined;

    if (!csvUrl) {
      if (config.envName) missingRemoteEnvironmentVariables.push(config.envName);
      const csvText = await readTemplateCsv(config.fileName);
      sheets[config.name] = parseCsv(csvText);
      sources[config.name] = "template";
      continue;
    }

    const csvText = await readRemoteCsv(csvUrl, config.name);
    sheets[config.name] = parseCsv(csvText);
    sources[config.name] = "remote";
  }

  if (requireRemoteContent && missingRemoteEnvironmentVariables.length > 0) {
    throw new Error(
      `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true but these CSV URL environment variables are missing: ${missingRemoteEnvironmentVariables.join(
        ", "
      )}`
    );
  }

  const metadata: GeneratedContentMetadata = {
    generatedAt: new Date().toISOString(),
    sourceMode: resolveSourceMode(sources),
    sources
  };

  const normalizedContent = normalizePortfolioContent(sheets, metadata);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(normalizedContent, null, 2)}\n`, "utf8");

  console.log(
    `Generated portfolio content at ${path.relative(projectRoot, outputPath)} using ${normalizedContent.metadata.sourceMode} content.`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Content generation failed: ${message}`);
  process.exitCode = 1;
});
