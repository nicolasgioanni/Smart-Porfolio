import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "../../..");

async function lintImport(filePath: string, importPath: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: projectRoot,
    overrideConfigFile: path.join(projectRoot, "eslint.config.mjs")
  });
  const [result] = await eslint.lintText(`import value from "${importPath}";\nvoid value;`, { filePath });

  return result.messages.map((message) => message.message);
}

async function expectRestrictedImport(filePath: string, importPath: string, expectedMessage: string): Promise<void> {
  expect(await lintImport(filePath, importPath)).toContainEqual(expect.stringContaining(expectedMessage));
}

describe("architecture import boundaries", () => {
  it("rejects UI and feature imports from library modules by alias and relative path", async () => {
    await expectRestrictedImport("src/lib/content/example.ts", "@/components/navigation/siteRoutes",
      "Library modules must not depend on presentation or feature modules."
    );
    await expectRestrictedImport("src/lib/content/example.ts", "../../components/navigation/siteRoutes",
      "Library modules must not depend on presentation or feature modules."
    );
    await expectRestrictedImport("src/lib/content/example.ts", "../../features/example",
      "Library modules must not depend on presentation or feature modules."
    );
  });

  it("rejects generated, function, and script imports from component modules", async () => {
    await expectRestrictedImport("src/components/example.tsx", "@/content/generated/portfolio.generated.json",
      "Components must receive content through supported application and library boundaries."
    );
    await expectRestrictedImport("src/components/example.tsx", "../../content/generated/portfolio.generated.json",
      "Components must receive content through supported application and library boundaries."
    );
    await expectRestrictedImport("src/components/example.tsx", "../../functions/api",
      "Components must receive content through supported application and library boundaries."
    );
    await expectRestrictedImport("src/components/example.tsx", "../../scripts/generateContent",
      "Components must receive content through supported application and library boundaries."
    );
  });

  it("permits library dependencies shared by components", async () => {
    await expect(lintImport("src/lib/content/example.ts", "@/lib/content/displayHelpers")).resolves.toEqual([]);
    await expect(lintImport("src/components/example.tsx", "@/lib/content/displayHelpers")).resolves.toEqual([]);
    await expect(lintImport("src/components/example.tsx", "@/content/types")).resolves.toEqual([]);
  });
});
