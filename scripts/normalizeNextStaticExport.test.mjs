import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import nextBuildAdapter from "./nextBuildAdapter.mjs";
import { normalizeNextStaticExportSegments } from "./normalizeNextStaticExport.mjs";

const temporaryDirectories = [];

async function createExportDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-next-export-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("Next.js static export segment normalization", () => {
  it("flattens Windows-emitted segment directories into the URLs requested by the client router", async () => {
    const exportDirectory = await createExportDirectory();
    const nestedDirectory = path.join(exportDirectory, "research", "__next.research", "__PAGE__");
    const secondRouteDirectory = path.join(exportDirectory, "experience", "__next.experience");
    const preservedBytes = Buffer.from([0, 255, 10, 13, 65]);
    await mkdir(nestedDirectory, { recursive: true });
    await mkdir(secondRouteDirectory, { recursive: true });
    await writeFile(path.join(nestedDirectory, "details.txt"), preservedBytes);
    await writeFile(path.join(secondRouteDirectory, "__PAGE__.txt"), "second route", "utf8");
    await writeFile(path.join(exportDirectory, "research", "__next._tree.txt"), "tree segment", "utf8");

    await expect(normalizeNextStaticExportSegments(exportDirectory)).resolves.toBe(2);
    await expect(
      readFile(path.join(exportDirectory, "research", "__next.research.__PAGE__.details.txt"))
    ).resolves.toEqual(preservedBytes);
    await expect(
      readFile(path.join(exportDirectory, "experience", "__next.experience.__PAGE__.txt"), "utf8")
    ).resolves.toBe("second route");
    await expect(readFile(path.join(exportDirectory, "research", "__next._tree.txt"), "utf8")).resolves.toBe(
      "tree segment"
    );
    await expect(access(path.join(exportDirectory, "research", "__next.research"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("leaves the already-flat Linux export layout unchanged", async () => {
    const exportDirectory = await createExportDirectory();
    const segmentPath = path.join(exportDirectory, "experience", "__next.experience.__PAGE__.txt");
    await mkdir(path.dirname(segmentPath), { recursive: true });
    await writeFile(segmentPath, "flat segment", "utf8");

    await expect(normalizeNextStaticExportSegments(exportDirectory)).resolves.toBe(0);
    await expect(readFile(segmentPath, "utf8")).resolves.toBe("flat segment");
  });

  it("does not reinterpret unrelated directories whose names merely begin with __next", async () => {
    const exportDirectory = await createExportDirectory();
    const unrelatedDirectory = path.join(exportDirectory, "research", "__nextfoo");
    await mkdir(unrelatedDirectory, { recursive: true });
    await writeFile(path.join(unrelatedDirectory, "notes.txt"), "unrelated", "utf8");

    await expect(normalizeNextStaticExportSegments(exportDirectory)).resolves.toBe(0);
    await expect(readFile(path.join(unrelatedDirectory, "notes.txt"), "utf8")).resolves.toBe("unrelated");
  });

  it("fails before moving data when a flattened target already exists", async () => {
    const exportDirectory = await createExportDirectory();
    const routeDirectory = path.join(exportDirectory, "projects");
    const nestedDirectory = path.join(routeDirectory, "__next.projects");
    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(path.join(nestedDirectory, "__PAGE__.txt"), "nested segment", "utf8");
    await writeFile(path.join(routeDirectory, "__next.projects.__PAGE__.txt"), "existing segment", "utf8");

    await expect(normalizeNextStaticExportSegments(exportDirectory)).rejects.toThrow(
      /Refusing to overwrite static export segment data/
    );
    await expect(readFile(path.join(nestedDirectory, "__PAGE__.txt"), "utf8")).resolves.toBe("nested segment");
    await expect(readFile(path.join(routeDirectory, "__next.projects.__PAGE__.txt"), "utf8")).resolves.toBe(
      "existing segment"
    );
  });

  it("rejects malformed entries and symbolic-link segment trees", async () => {
    const malformedExport = await createExportDirectory();
    const malformedDirectory = path.join(malformedExport, "resume", "__next.resume");
    await mkdir(malformedDirectory, { recursive: true });
    await writeFile(path.join(malformedDirectory, "__PAGE__.json"), "{}", "utf8");

    await expect(normalizeNextStaticExportSegments(malformedExport)).rejects.toThrow(/unexpected entry/);

    const linkedExport = await createExportDirectory();
    const linkedTarget = path.join(linkedExport, "segment-target");
    const routeDirectory = path.join(linkedExport, "contact");
    await mkdir(linkedTarget, { recursive: true });
    await mkdir(routeDirectory, { recursive: true });
    await writeFile(path.join(linkedTarget, "__PAGE__.txt"), "linked segment", "utf8");
    await symlink(linkedTarget, path.join(routeDirectory, "__next.contact"), "junction");

    await expect(normalizeNextStaticExportSegments(linkedExport)).rejects.toThrow(/cannot be a symbolic link/);
  });

  it("rejects candidate roots outside Next 16.3.4's single encoded-segment grammar", async () => {
    const exportDirectory = await createExportDirectory();
    const malformedDirectory = path.join(exportDirectory, "terms", "__next.terms.extra");
    await mkdir(malformedDirectory, { recursive: true });
    await writeFile(path.join(malformedDirectory, "__PAGE__.txt"), "malformed segment", "utf8");

    await expect(normalizeNextStaticExportSegments(exportDirectory)).rejects.toThrow(/malformed segment directory/);
    await expect(readFile(path.join(malformedDirectory, "__PAGE__.txt"), "utf8")).resolves.toBe(
      "malformed segment"
    );
  });

  it("rejects malformed descendant segment names without moving data", async () => {
    const exportDirectory = await createExportDirectory();
    const candidateRoot = path.join(exportDirectory, "terms", "__next.terms");
    const malformedDirectory = path.join(candidateRoot, "future.segment");
    await mkdir(malformedDirectory, { recursive: true });
    await writeFile(path.join(malformedDirectory, "__PAGE__.txt"), "malformed segment", "utf8");

    await expect(normalizeNextStaticExportSegments(exportDirectory)).rejects.toThrow(/malformed path segment/);
    await expect(readFile(path.join(malformedDirectory, "__PAGE__.txt"), "utf8")).resolves.toBe(
      "malformed segment"
    );
  });
});

describe("Next.js build adapter", () => {
  it("normalizes projectDir/out only after a static export build", async () => {
    const projectDirectory = await createExportDirectory();
    const nestedDirectory = path.join(projectDirectory, "out", "privacy", "__next.privacy");
    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(path.join(nestedDirectory, "__PAGE__.txt"), "adapter segment", "utf8");

    await expect(
      nextBuildAdapter.onBuildComplete({ config: { output: "export" }, projectDir: projectDirectory })
    ).resolves.toBeUndefined();
    await expect(
      readFile(path.join(projectDirectory, "out", "privacy", "__next.privacy.__PAGE__.txt"), "utf8")
    ).resolves.toBe("adapter segment");
  });

  it("rejects a non-export build before reading output", async () => {
    const projectDirectory = await createExportDirectory();

    await expect(
      nextBuildAdapter.onBuildComplete({ config: { output: undefined }, projectDir: projectDirectory })
    ).rejects.toThrow(/requires Next\.js static export mode/);
  });
});
