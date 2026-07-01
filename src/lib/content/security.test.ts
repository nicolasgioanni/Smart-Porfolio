import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function collectFiles(directory: string, extensions: string[]): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(entryPath, extensions);
    }

    return extensions.includes(path.extname(entry.name)) ? [entryPath] : [];
  });
}

describe("static portfolio security contracts", () => {
  it("does not define API routes, route handlers, or server actions", () => {
    const appFiles = collectFiles(path.join(projectRoot, "src", "app"), [".ts", ".tsx"]);
    const routeHandlers = appFiles.filter((filePath) => path.basename(filePath).startsWith("route."));
    const serverActionFiles = appFiles.filter((filePath) => readFileSync(filePath, "utf8").includes("\"use server\""));

    expect(routeHandlers).toEqual([]);
    expect(serverActionFiles).toEqual([]);
  });

  it("does not fetch portfolio content at runtime from source files", () => {
    const sourceFiles = collectFiles(path.join(projectRoot, "src"), [".ts", ".tsx"]).filter((filePath) => !filePath.endsWith(".test.ts"));
    const runtimeFetchFiles = sourceFiles.filter((filePath) => readFileSync(filePath, "utf8").includes("fetch("));

    expect(runtimeFetchFiles).toEqual([]);
  });

  it("keeps scroll motion free of text blur", () => {
    const motionCss = readFileSync(path.join(projectRoot, "src", "styles", "motion.css"), "utf8");

    expect(motionCss).not.toMatch(/filter:\s*blur/);
    expect(motionCss).not.toMatch(/transition:[^;]*filter/s);
  });
});
