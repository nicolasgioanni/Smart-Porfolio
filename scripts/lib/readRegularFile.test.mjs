// @vitest-environment node
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRegularFile } from "./readRegularFile.mjs";

const directories = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("descriptor-bound regular file reads", () => {
  it("reads exact bytes at the boundary without following links or accepting directories", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-regular-file-")); directories.push(root);
    const file = path.join(root, "file");
    const bytes = Buffer.alloc(130_000, 0xab);
    await writeFile(file, bytes);
    expect(await readRegularFile(file, { maximumBytes: bytes.length })).toEqual(bytes);
    await expect(readRegularFile(file, { maximumBytes: bytes.length - 1 })).rejects.toThrow("budget");
    await symlink(file, path.join(root, "linked"));
    await expect(readRegularFile(path.join(root, "linked"), { maximumBytes: bytes.length })).rejects.toThrow();
    await mkdir(path.join(root, "directory"));
    await expect(readRegularFile(path.join(root, "directory"), { maximumBytes: bytes.length })).rejects.toThrow("regular file");
  });

  it("rejects empty required files and invalid budgets", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-regular-file-")); directories.push(root);
    const file = path.join(root, "empty"); await writeFile(file, "");
    expect(await readRegularFile(file, { maximumBytes: 0 })).toEqual(Buffer.alloc(0));
    await expect(readRegularFile(file, { minimumBytes: 1, maximumBytes: 4 })).rejects.toThrow("budget");
    for (const maximumBytes of [-1, 1.5, Infinity, NaN]) {
      await expect(readRegularFile(file, { maximumBytes })).rejects.toThrow("limits");
    }
  });
});
