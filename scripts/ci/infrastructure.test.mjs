// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { discoverTerraformRoots, verifyOfflineInfrastructure } from "./infrastructure.mjs";

describe("credential-free infrastructure acceptance", () => {
  it("discovers every prepared root and requires mock tests for future roots", async () => {
    expect(await discoverTerraformRoots()).toHaveLength(8);
    const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-infrastructure-discovery-"));
    try {
      await mkdir(path.join(root, "infra/states"), { recursive: true });
      const module = path.join(root, "infra/modules/new-control");
      await mkdir(path.join(module, "tests"), { recursive: true });
      await Promise.all(["main.tf", ".terraform.lock.hcl"].map((file) => writeFile(path.join(module, file), "")));
      await expect(discoverTerraformRoots(root)).rejects.toThrow("mock suite");
      await writeFile(path.join(module, "tests/control.tftest.hcl"), "");
      expect(await discoverTerraformRoots(root)).toEqual(["infra/modules/new-control"]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("initializes locked providers with backends disabled before mock validation, without credentials or command overrides", async () => {
    const run = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const result = await verifyOfflineInfrastructure({ terraform: "/tools/terraform", opa: "/tools/opa", run,
      discover: async () => ["infra/states/fixture"], environment: { PATH: "/bin", HOME: "/fixture", GH_TOKEN: "secret",
        TF_TOKEN_app_terraform_io: "secret", CLOUDFLARE_API_TOKEN: "secret", TF_CLI_ARGS: "-target=unexpected" } });
    expect(result).toEqual({ roots: 1, completed: 6 });
    expect(run.mock.calls.map(([, args]) => args)).toEqual([
      ["infra/validate-ownership.mjs"], ["fmt", "-check", "-recursive", "infra"],
      ["-chdir=infra/states/fixture", "init", "-backend=false", "-lockfile=readonly", "-input=false", "-no-color"],
      ["-chdir=infra/states/fixture", "validate", "-no-color"], ["-chdir=infra/states/fixture", "test", "-no-color"],
      ["--test", "infra/tests/saved-plan.test.mjs", "infra/tests/check-plan.test.mjs", "infra/tests/mock-plan-export.test.mjs"]
    ]);
    for (const [, , options] of run.mock.calls) {
      for (const key of ["GH_TOKEN", "TF_CLI_ARGS", "CLOUDFLARE_API_TOKEN", "TF_TOKEN_app_terraform_io"]) expect(options.env).not.toHaveProperty(key);
      expect(JSON.stringify(options.env)).not.toContain("secret");
      expect(options.env.TF_CLI_CONFIG_FILE).toBe("/dev/null");
    }
  });

  it("stops immediately on initialization failure and never publishes provider diagnostic details", async () => {
    const run = vi.fn(async (_binary, args) => {
      if (args.includes("init")) throw new Error("PRIVATE_PROVIDER_SENTINEL");
      return { stdout: "", stderr: "" };
    });
    await expect(verifyOfflineInfrastructure({ terraform: "/tools/terraform", opa: "/tools/opa", run,
      discover: async () => ["infra/states/fixture"] })).rejects.toThrow("fixture initialization");
    expect(run).toHaveBeenCalledTimes(3);
  });
});
