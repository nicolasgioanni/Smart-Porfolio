import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  listIntents,
  normalizeIntent,
  readOwnershipManifest,
  readRouteCard,
  resolveIntent,
} from "./routeAgentWork.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function readManifest() {
  return JSON.parse(
    await readFile(
      path.join(projectRoot, ".agents", "ownership-manifest.json"),
      "utf8",
    ),
  );
}

describe("agent work routing", () => {
  it("normalizes aliases and lists them deterministically", async () => {
    const manifest = await readManifest();

    expect(normalizeIntent("  Project Visuals  ")).toBe("project-visuals");
    expect(listIntents(manifest)).toEqual(
      [...listIntents(manifest)].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    );
  });

  it("routes representative subsystem aliases to their direct cards", async () => {
    const manifest = await readManifest();
    const cases = [
      ["content", "content"],
      ["theme", "shared-theme"],
      ["research", "portfolio-evidence"],
      ["contact", "contact-browser"],
      ["d1", "contact-functions-d1"],
      ["skeleton", "skeleton-regression"],
      ["deployment", "release-deployment"],
      ["docs", "docs-maintenance"],
      ["terraform", "infrastructure-baseline"],
    ];

    for (const [intent, id] of cases) {
      const owner = resolveIntent(manifest, intent);
      expect(owner?.id).toBe(id);
      const card = await readRouteCard(owner, projectRoot);
      expect(card).toMatch(/^# /);
      expect(card).toMatch(/npm run/);
    }
  });

  it("rejects malformed manifests and cards outside the direct card directory", async () => {
    const manifest = await readManifest();
    expect(() => listIntents({ owners: [{ id: "broken" }] })).toThrow(
      "Ownership manifest must contain valid owners",
    );
    expect(resolveIntent(manifest, "unknown-intent")).toBeUndefined();

    const malformedRoot = await mkdtemp(
      path.join(os.tmpdir(), "agent-route-manifest-test-"),
    );
    try {
      await mkdir(path.join(malformedRoot, ".agents"), { recursive: true });
      await writeFile(
        path.join(malformedRoot, ".agents", "ownership-manifest.json"),
        "{not JSON}\n",
        "utf8",
      );
      await expect(readOwnershipManifest(malformedRoot)).rejects.toThrow(
        "Ownership manifest must contain valid JSON",
      );
    } finally {
      await rm(malformedRoot, { recursive: true, force: true });
    }

    await expect(
      readRouteCard({ card: "../README.md" }, projectRoot),
    ).rejects.toThrow("Owner card must be a direct .agents/cards Markdown file");

    const root = await mkdtemp(path.join(os.tmpdir(), "agent-route-test-"));
    try {
      await mkdir(path.join(root, ".agents", "cards"), { recursive: true });
      await writeFile(path.join(root, "outside.md"), "# Outside\n", "utf8");
      await symlink(
        path.join(root, "outside.md"),
        path.join(root, ".agents", "cards", "escaped.md"),
      );
      await expect(
        readRouteCard({ card: ".agents/cards/escaped.md" }, root),
      ).rejects.toThrow("Owner card must stay inside .agents/cards");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects internal and external manifest symlinks without exposing their contents", async () => {
    const outside = await mkdtemp(path.join(os.tmpdir(), "agent-route-private-manifest-"));
    try {
      for (const targetType of ["internal", "external"]) {
        const root = await mkdtemp(path.join(os.tmpdir(), "agent-route-manifest-symlink-"));
        const sentinel = `route-private-sentinel-${targetType}`;
        const target =
          targetType === "internal"
            ? path.join(root, ".env")
            : path.join(outside, `${targetType}.txt`);
        try {
          await mkdir(path.join(root, ".agents"), { recursive: true });
          await writeFile(target, `{"private":"${sentinel}"`, "utf8");
          await symlink(
            target,
            path.join(root, ".agents", "ownership-manifest.json"),
          );

          let message = "";
          try {
            await readOwnershipManifest(root);
          } catch (error) {
            message = error instanceof Error ? error.message : String(error);
          }
          expect(message).toBe("Ownership manifest must contain valid JSON");
          expect(message).not.toContain(sentinel);
          expect(message).not.toContain("Unexpected token");
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
