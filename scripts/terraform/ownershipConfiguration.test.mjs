import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readOwnershipManifest, validateOwnershipConfiguration } from "./ownershipConfiguration.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");

async function ownershipFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-terraform-config-"));
  await cp(path.join(projectRoot, "infra"), path.join(root, "infra"), { recursive: true });
  return root;
}

describe("Terraform ownership configuration", () => {
  it("keeps four independent roots, pinned providers, locks, and logical ownership", async () => {
    const { errors, manifest } = await validateOwnershipConfiguration({ root: projectRoot });

    expect(errors).toEqual([]);
    expect(manifest.roots.map(({ name }) => name)).toEqual([
      "shared",
      "preview",
      "production",
      "github-governance",
    ]);
    expect(manifest.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        root: "preview",
        address: "cloudflare_d1_database.contact_rate_limit",
        expectedName: "smart-portfolio-contact-rate-limit-preview",
        migrations: "release_workflow_owned",
      }),
      expect.objectContaining({
        root: "production",
        address: "cloudflare_d1_database.contact_rate_limit",
        expectedName: "smart-portfolio-contact-rate-limit-production",
        migrations: "release_workflow_owned",
      }),
      expect.objectContaining({
        root: "github-governance",
        address: "github_repository_ruleset.permanent_branches",
        targetRefs: ["refs/heads/main", "refs/heads/develop"],
      }),
    ]));
  });

  it("keeps backend, cross-root state, aliases, and GitHub bypasses out of adoption roots", async () => {
    const manifest = await readOwnershipManifest({ root: projectRoot });
    const rootSources = await Promise.all(
      manifest.roots.map(async ({ directory }) => {
        const names = ["versions.tf", "main.tf", "variables.tf"];
        const sources = await Promise.all(
          names.map((name) => readFile(path.join(projectRoot, directory, name), "utf8")),
        );
        return sources.join("\n");
      }),
    );
    const githubSource = rootSources.at(-1);

    for (const source of rootSources) {
      expect(source).not.toMatch(/\bterraform_remote_state\b/);
      expect(source).not.toMatch(/\bbackend\s+"/);
      expect(source).not.toMatch(/\balias\s*=/);
    }
    expect(githubSource).toMatch(/deletion\s*=\s*true/);
    expect(githubSource).toMatch(/non_fast_forward\s*=\s*true/);
    expect(githubSource).toMatch(/refs\/heads\/main[\s\S]*refs\/heads\/develop/);
    expect(githubSource).toMatch(/prevent_destroy\s*=\s*true/);
    expect(githubSource).not.toMatch(/\bbypass_actors\b/);
  });

  it.each([
    ["HCP activation", "infra/roots/shared/main.tf", "terraform { cloud {} }\n", "HCP Terraform activation"],
    ["JSON configuration", "infra/roots/preview/unsafe.tf.json", "{}\n", "operational, JSON, or override"],
    ["state artifact", "infra/roots/preview/review.tfstate", "{}\n", "operational artifacts"],
    ["plan artifact", "infra/roots/preview/review.tfplan", "opaque\n", "operational artifacts"],
    ["variable artifact", "infra/roots/preview/review.tfvars", "account = \"x\"\n", "operational artifacts"],
    ["top-level private state artifact", "infra/private.tfstate", "opaque\n", "operational artifacts"],
    ["nested state artifact", "infra/roots/preview/private/review.tfstate", "opaque\n", "operational artifacts"],
    ["nested plan artifact", "infra/roots/preview/private/review.tfplan", "opaque\n", "operational artifacts"],
    ["nested variable artifact", "infra/roots/preview/private/review.tfvars", "account = \"x\"\n", "operational artifacts"],
    ["nested data directory", "infra/roots/preview/private/.terraform/cache", "opaque\n", "operational artifacts"],
    ["unreviewed GitHub protection", "infra/roots/github-governance/main.tf", "\n    update = true\n", "must not add active rules"],
  ])("rejects %s inside a Terraform root", async (_name, relativePath, contents, expectedError) => {
    const root = await ownershipFixture();
    try {
      const target = path.join(root, relativePath);
      if (relativePath.endsWith("main.tf")) {
        await writeFile(target, `${await readFile(target, "utf8")}${contents}`, "utf8");
      } else {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, contents, "utf8");
      }
      const result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain(expectedError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects source escapes, provider drift, malformed locks, and symlinked roots", async () => {
    const root = await ownershipFixture();
    try {
      const manifestPath = path.join(root, "infra", "ownership-manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifest.roots[1].directory = "../outside";
      await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
      let result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("invalid fixed contract for preview");

      manifest.roots[1].directory = "infra/roots/preview";
      await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
      const versionPath = path.join(root, "infra", "roots", "preview", "versions.tf");
      await writeFile(versionPath, (await readFile(versionPath, "utf8")).replace("cloudflare/cloudflare", "example/unsafe"), "utf8");
      result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("provider local name");

      await writeFile(versionPath, await readFile(path.join(projectRoot, "infra", "roots", "preview", "versions.tf"), "utf8"), "utf8");
      const lockPath = path.join(root, "infra", "roots", "preview", ".terraform.lock.hcl");
      await writeFile(lockPath, `${await readFile(lockPath, "utf8")}\nprovider "registry.terraform.io/example/unsafe" {}\n`, "utf8");
      result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("only its reviewed provider source");

      await writeFile(lockPath, await readFile(path.join(projectRoot, "infra", "roots", "preview", ".terraform.lock.hcl"), "utf8"), "utf8");
      await writeFile(lockPath, (await readFile(lockPath, "utf8")).replace(/h1:[A-Za-z0-9+/=]+/, "h1:short"), "utf8");
      result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("exact reviewed provider checksum set");

      await rm(path.join(root, "infra", "roots", "preview"), { recursive: true, force: true });
      await symlink(path.join(projectRoot, "infra", "roots", "preview"), path.join(root, "infra", "roots", "preview"));
      result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("must not be a symbolic link");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires exact reviewed provider constraints and checksums", async () => {
    const root = await ownershipFixture();
    try {
      const lockPath = path.join(root, "infra", "roots", "preview", ".terraform.lock.hcl");
      const original = await readFile(lockPath, "utf8");

      await writeFile(lockPath, original.replace('constraints = "5.27.0"', 'constraints = "~> 5.27"'), "utf8");
      let result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("reviewed provider constraints");

      await writeFile(lockPath, original.replace(/zh:[a-f0-9]{64}/, `zh:${"a".repeat(64)}`), "utf8");
      result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("exact reviewed provider checksum set");

      await writeFile(lockPath, original.replace("  ]", `    "zh:${"b".repeat(64)}",\n  ]`), "utf8");
      result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("exact reviewed provider checksum set");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects manifest and ancestor symlinks before reading their contents", async () => {
    const root = await ownershipFixture();
    const externalDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-terraform-external-"));
    try {
      const manifestPath = path.join(root, "infra", "ownership-manifest.json");
      const privateContent = "PRIVATE_MANIFEST_CONTENT_MUST_NOT_APPEAR";
      const externalManifest = path.join(externalDirectory, "private-manifest.json");
      await writeFile(externalManifest, `{ ${privateContent}`, "utf8");
      await rm(manifestPath);
      await symlink(externalManifest, manifestPath);

      let result = await validateOwnershipConfiguration({ root });
      expect(result.errors).toEqual(["ownership manifest is not readable JSON"]);
      expect(result.errors.join("\n")).not.toContain(privateContent);

      await rm(manifestPath);
      await writeFile(manifestPath, await readFile(path.join(projectRoot, "infra", "ownership-manifest.json"), "utf8"), "utf8");
      const externalInfra = path.join(externalDirectory, "infra");
      await cp(path.join(projectRoot, "infra"), externalInfra, { recursive: true });
      await rm(path.join(root, "infra"), { recursive: true, force: true });
      await symlink(externalInfra, path.join(root, "infra"));

      result = await validateOwnershipConfiguration({ root });
      expect(result.errors).toEqual(["ownership manifest is not readable JSON"]);
      expect(result.errors.join("\n")).not.toContain(privateContent);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(externalDirectory, { recursive: true, force: true });
    }
  });

  it("rejects unreviewed root directories and all symlinked infrastructure entries", async () => {
    const root = await ownershipFixture();
    try {
      await mkdir(path.join(root, "infra", "roots", "unreviewed"), { recursive: true });
      await symlink(path.join(root, "infra", "README.md"), path.join(root, "infra", "roots", "preview", "private-link"));

      const result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("infra/roots/unreviewed is not a reviewed Terraform root");
      expect(result.errors.join("\n")).toContain("infra/roots/preview/private-link must not be a symbolic link");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a manifest that softens a reviewed resource contract", async () => {
    const root = await ownershipFixture();
    try {
      const manifestPath = path.join(root, "infra", "ownership-manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifest.resources[0].expectedName = "other-database";
      await writeFile(manifestPath, JSON.stringify(manifest), "utf8");

      const result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("invalid fixed resource contract for preview:cloudflare_d1_database.contact_rate_limit");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a worktree-local Terraform data directory", async () => {
    const root = await ownershipFixture();
    try {
      await mkdir(path.join(root, "infra", "roots", "shared", ".terraform"));
      const result = await validateOwnershipConfiguration({ root });
      expect(result.errors.join("\n")).toContain("operational artifacts");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
