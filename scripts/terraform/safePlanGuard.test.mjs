import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validatePrivateRecordSchemas } from "./privateRecordSchemas.mjs";
import { sanitizedTerraformEnvironment, verifySavedPlan, writePrivateTerraformOutput } from "./safePlanGuard.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const sourceCommit = "a".repeat(40);
const sha = (character) => character.repeat(64);
const temporaryDirectories = [];

function privateInventory() {
  return {
    schemaVersion: 1,
    collectedAt: "2026-10-09T00:00:00.000Z",
    evidence: {
      source: "operator-supplied policy input; authenticated provider APIs and state must be checked separately",
      refreshedAt: "2026-10-09T00:00:00.000Z",
    },
    roots: [
      {
        name: "shared",
        workspace: { id: "ws-shared", name: "shared", organization: "org", project: "project", executionMode: "local" },
        state: { versionId: "sv-shared", lineage: "lineage-shared", serial: 1, sha256: sha("a") },
        providers: { cloudflare: { accountId: "account-id" } },
        resources: [],
      },
      {
        name: "preview",
        workspace: { id: "ws-preview", name: "preview", organization: "org", project: "project", executionMode: "local" },
        state: { versionId: "sv-preview", lineage: "lineage-preview", serial: 2, sha256: sha("b") },
        providers: { cloudflare: { accountId: "account-id" } },
        resources: [{ address: "cloudflare_d1_database.contact_rate_limit", resourceId: "d1-preview", accountId: "account-id", environment: "preview" }],
      },
      {
        name: "production",
        workspace: { id: "ws-production", name: "production", organization: "org", project: "project", executionMode: "local" },
        state: { versionId: "sv-production", lineage: "lineage-production", serial: 3, sha256: sha("c") },
        providers: { cloudflare: { accountId: "account-id" } },
        resources: [{ address: "cloudflare_d1_database.contact_rate_limit", resourceId: "d1-production", accountId: "account-id", environment: "production" }],
      },
      {
        name: "github-governance",
        workspace: { id: "ws-github", name: "github", organization: "org", project: "project", executionMode: "local" },
        state: { versionId: "sv-github", lineage: "lineage-github", serial: 4, sha256: sha("d") },
        providers: { github: { ownerId: "owner-id", ownerLogin: "owner", repositoryId: "repository-id", repository: "Smart-Porfolio" } },
        resources: [{ address: "github_repository_ruleset.permanent_branches", resourceId: "ruleset-owner-id", rulesetId: "123456789", ownerId: "owner-id", repositoryId: "repository-id", repository: "Smart-Porfolio", environment: "github-governance" }],
      },
    ],
  };
}

function previewPlan() {
  return {
    format_version: "1.2",
    terraform_version: "1.16.5",
    applyable: false,
    complete: true,
    errored: false,
    resource_changes: [{
      address: "cloudflare_d1_database.contact_rate_limit",
      provider_name: "registry.terraform.io/cloudflare/cloudflare",
      change: {
        actions: ["no-op"],
        after: { id: "d1-preview", account_id: "account-id", name: "smart-portfolio-contact-rate-limit-preview" },
        after_unknown: {},
        replace_paths: [],
      },
    }],
  };
}

function sharedPlan() {
  return {
    format_version: "1.2",
    terraform_version: "1.16.5",
    applyable: false,
    complete: true,
    errored: false,
  };
}

function githubPlan() {
  return {
    format_version: "1.2",
    terraform_version: "1.16.5",
    applyable: false,
    complete: true,
    errored: false,
    variables: {
      github_owner: { value: "owner" },
      github_repository: { value: "Smart-Porfolio" },
    },
    resource_changes: [{
      address: "github_repository_ruleset.permanent_branches",
      provider_name: "registry.terraform.io/integrations/github",
      change: {
        actions: ["no-op"],
        after: {
          id: "ruleset-owner-id",
          ruleset_id: 123456789,
          repository: "Smart-Porfolio",
          name: "protect-permanent-branches",
          target: "branch",
          enforcement: "active",
          conditions: [{ ref_name: [{ include: ["refs/heads/main", "refs/heads/develop"], exclude: [] }] }],
          rules: [{
            deletion: true,
            non_fast_forward: true,
            creation: false,
            required_linear_history: false,
            required_signatures: false,
            update: false,
            update_allows_fetch_and_merge: false,
            branch_name_pattern: [],
            commit_author_email_pattern: [],
            commit_message_pattern: [],
            committer_email_pattern: [],
            copilot_code_review: [],
            file_extension_restriction: [],
            file_path_restriction: [],
            max_file_path_length: [],
            max_file_size: [],
            merge_queue: [],
            pull_request: [],
            required_code_scanning: [],
            required_deployments: [],
            required_status_checks: [],
            tag_name_pattern: [],
          }],
          bypass_actors: [],
        },
        after_unknown: {},
        replace_paths: [],
      },
    }],
  };
}

async function sha256(filePath) {
  const crypto = await import("node:crypto");
  const source = await (await import("node:fs/promises")).readFile(filePath);
  return crypto.createHash("sha256").update(source).digest("hex");
}

async function rootDigest(rootName, includeLock) {
  const fs = await import("node:fs/promises");
  const crypto = await import("node:crypto");
  const rootDirectory = path.join(projectRoot, "infra", "roots", rootName);
  const entries = await fs.readdir(rootDirectory, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".tf")).map((entry) => entry.name).sort();
  const contents = await Promise.all(names.map(async (name) => `${name}\u0000${await fs.readFile(path.join(rootDirectory, name), "utf8")}`));
  if (includeLock) return sha256(path.join(rootDirectory, ".terraform.lock.hcl"));
  return crypto.createHash("sha256").update(contents.join("\u0000")).digest("hex");
}

async function writeInputs({ rootName = "preview", inventory = privateInventory(), plan = rootName === "shared" ? sharedPlan() : rootName === "github-governance" ? githubPlan() : previewPlan(), approvalMutation } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-safe-plan-"));
  temporaryDirectories.push(directory);
  const savedPlanPath = path.join(directory, "review.tfplan");
  const planJsonPath = path.join(directory, "review.json");
  const inventoryPath = path.join(directory, "private-runtime-inventory.json");
  const approvalPath = path.join(directory, "plan-approval.json");
  await writeFile(savedPlanPath, "opaque saved plan bytes", "utf8");
  await writeFile(planJsonPath, JSON.stringify(plan), "utf8");
  await writeFile(inventoryPath, JSON.stringify(inventory), "utf8");
  const approval = {
    schemaVersion: 1,
    root: rootName,
    sourceCommit,
    configSha256: await rootDigest(rootName, false),
    lockSha256: await rootDigest(rootName, true),
    inventorySha256: await sha256(inventoryPath),
    savedPlanSha256: await sha256(savedPlanPath),
    planJsonSha256: await sha256(planJsonPath),
    terraform: { version: "1.16.5", binarySha256: sha("e") },
    providers: rootName === "github-governance"
      ? { "registry.terraform.io/integrations/github": "6.13.0" }
      : { "registry.terraform.io/cloudflare/cloudflare": "5.27.0" },
    workspace: (() => {
      const root = inventory.roots.find((entry) => entry.name === rootName);
      return { id: root.workspace.id, name: root.workspace.name, stateVersionId: root.state.versionId, lineage: root.state.lineage, serial: root.state.serial };
    })(),
  };
  approvalMutation?.(approval);
  await writeFile(approvalPath, JSON.stringify(approval), "utf8");
  return { approvalPath, inventoryPath, planJsonPath, savedPlanPath };
}

async function verify(options = {}) {
  const inputs = await writeInputs(options);
  return verifySavedPlan({
    projectRoot,
    rootName: options.rootName ?? "preview",
    sourceCommit,
    environment: {},
    terraformIdentity: { version: "1.16.5", binarySha256: sha("e") },
    terraformShowJson: async () => readFile(inputs.planJsonPath, "utf8"),
    ...inputs,
  });
}

async function verifyInputs(inputs, options = {}) {
  return verifySavedPlan({
    projectRoot,
    rootName: options.rootName ?? "preview",
    sourceCommit,
    environment: options.environment ?? {},
    terraformIdentity: { version: "1.16.5", binarySha256: sha("e") },
    terraformShowJson: options.terraformShowJson ?? (async () => readFile(inputs.planJsonPath, "utf8")),
    ...options,
    ...inputs,
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("offline Terraform saved-plan guard", () => {
  it("replaces a private output symlink without following it into a Git worktree", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-private-output-"));
    temporaryDirectories.push(directory);
    const outputPath = path.join(directory, "review.json");
    const protectedPath = path.join(projectRoot, "package.json");
    const protectedSource = await readFile(protectedPath, "utf8");
    await symlink(protectedPath, outputPath);

    await writePrivateTerraformOutput({ outputPath, contents: "{\"safe\":true}\n", projectRoot });

    expect(await readFile(protectedPath, "utf8")).toBe(protectedSource);
    expect(await readFile(outputPath, "utf8")).toBe("{\"safe\":true}\n");
    expect((await lstat(outputPath)).mode & 0o777).toBe(0o600);
  });

  it("binds a complete no-op saved plan while retaining explicit activation blockers", async () => {
    const result = await verify();

    expect(result.ok).toBe(true);
    expect(result.reviewBinding).toMatchObject({ root: "preview", sourceCommit });
    expect(result.limitations).toEqual(expect.arrayContaining([
      expect.stringContaining("not as proof of live provider"),
      expect.stringContaining("cannot authorize import or apply"),
    ]));
  });

  it("accepts the pinned Terraform empty-root no-op shape", async () => {
    const result = await verify({ rootName: "shared" });

    expect(result.ok).toBe(true);
    expect(result.reviewBinding.root).toBe("shared");
  });

  it("accepts a schema-realistic GitHub no-op with every inactive pinned-provider rule block empty", async () => {
    const result = await verify({ rootName: "github-governance" });

    expect(result.ok).toBe(true);
  });

  it.each([
    ["delete", (plan) => { plan.resource_changes[0].change.actions = ["delete"]; }, "must be a no-op"],
    ["replacement", (plan) => { plan.resource_changes[0].change.replace_paths = [["name"]]; }, "replaces"],
    ["unknown output", (plan) => { plan.resource_changes[0].change.after_unknown = { id: true }; }, "unknown values"],
    ["unapproved import", (plan) => { plan.resource_changes[0].change.importing = { id: "d1-preview" }; }, "contains an import"],
    ["wrong environment resource", (plan) => { plan.resource_changes[0].address = "cloudflare_d1_database.production_rate_limit"; }, "unowned or cross-root"],
    ["wrong resource name", (plan) => { plan.resource_changes[0].change.after.name = "other"; }, "wrong named resource"],
    ["wrong physical D1", (plan) => { plan.resource_changes[0].change.after.id = "other-d1"; }, "wrong physical resource ID"],
    ["wrong Cloudflare account", (plan) => { plan.resource_changes[0].change.after.account_id = "other-account"; }, "wrong Cloudflare account"],
  ])("rejects a %s plan", async (_name, mutate, expectedError) => {
    const plan = previewPlan();
    mutate(plan);
    const result = await verify({ plan });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(expectedError);
  });

  it("binds permanent-branch ruleset identity and rejects weakened coverage", async () => {
    const plan = githubPlan();
    plan.resource_changes[0].change.after.conditions[0].ref_name[0].include = ["refs/heads/main"];
    plan.resource_changes[0].change.after.rules[0].non_fast_forward = false;
    plan.resource_changes[0].change.after.bypass_actors = [{ actor_id: 1 }];
    const result = await verify({ rootName: "github-governance", plan });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("wrong permanent-branch scope");
    expect(result.errors.join("\n")).toContain("weakens deletion or non-fast-forward");
    expect(result.errors.join("\n")).toContain("bypass actor");
  });

  it("rejects self-attested inventory conflicts and stale approval bindings", async () => {
    const inventory = privateInventory();
    inventory.roots[2].resources[0].resourceId = "d1-preview";
    inventory.roots[1].resources[0].environment = "production";
    const result = await verify({
      inventory,
      approvalMutation: (approval) => {
        approval.sourceCommit = "b".repeat(40);
        approval.workspace.serial = 99;
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("reuses resource ID");
    expect(result.errors.join("\n")).toContain("wrong environment");
    expect(result.errors.join("\n")).toContain("sourceCommit does not match");
    expect(result.errors.join("\n")).toContain("workspace serial does not match");
  });

  it("rejects missing policy inputs, malformed output, and Terraform command overrides", async () => {
    const inputs = await writeInputs();
    await writeFile(inputs.inventoryPath, "{}", "utf8");
    await writeFile(inputs.planJsonPath, "not JSON", "utf8");
    const result = await verifySavedPlan({
      projectRoot,
      rootName: "preview",
      sourceCommit,
      environment: { TF_CLI_ARGS_plan: "-destroy", TF_WORKSPACE: "other" },
      terraformIdentity: { version: "1.16.5", binarySha256: sha("e") },
      ...inputs,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("private runtime inventory schemaVersion");
    expect(result.errors.join("\n")).toContain("Terraform show JSON is malformed");
    expect(result.errors.join("\n")).toContain("TF_CLI_ARGS_plan");
    expect(result.errors.join("\n")).toContain("TF_WORKSPACE");
  });

  it("rejects deferred work, reported drift, and unknown outputs", async () => {
    const plan = previewPlan();
    plan.deferred_changes = [{ reason: "provider" }];
    plan.resource_drift = [{ address: "cloudflare_d1_database.contact_rate_limit" }];
    plan.output_changes = { future: { after_unknown: true } };
    const result = await verify({ plan });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("deferred changes");
    expect(result.errors.join("\n")).toContain("resource drift");
    expect(result.errors.join("\n")).toContain("unknown output future");
  });

  it("rejects unknown and non-passing Terraform checks", async () => {
    const plan = previewPlan();
    plan.checks = [{ status: "pass", instances: [{ status: "unknown" }] }, { status: "fail" }];
    const result = await verify({ plan });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("failing, errored, or unknown checks");
  });

  it.each(["TF_LOG", "TF_LOG_PATH", "TF_LOG_CORE", "TF_LOG_PROVIDER", "TF_LOG_SDK", "TF_LOG_PROVIDER_SDK"])("rejects %s before any child command can write review data", async (name) => {
    const inputs = await writeInputs();
    const result = await verifyInputs(inputs, { environment: { [name]: "/tmp/trace.log" } });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(`${name} must not enable Terraform trace output`);
  });

  it("removes every Terraform log setting before a child process inherits the environment", () => {
    const environment = {
      TF_LOG: "trace",
      TF_LOG_PATH: "/private/trace.log",
      TF_LOG_SDK: "debug",
      TF_LOG_PROVIDER_SDK: "debug",
      TF_VAR_environment: "preview",
    };

    expect(sanitizedTerraformEnvironment(environment)).toEqual({ TF_VAR_environment: "preview" });
  });

  it("requires regenerated Terraform show output to equal the reviewed saved-plan JSON", async () => {
    const inputs = await writeInputs();
    const result = await verifyInputs(inputs, {
      terraformShowJson: async () => JSON.stringify({ format_version: "1.2", terraform_version: "1.16.5" }),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("does not exactly match the reviewed saved-plan JSON");
  });

  it.each([
    ["plan", "planJsonPath"],
    ["inventory", "inventoryPath"],
    ["approval", "approvalPath"],
  ])("rejects every non-object and empty-object %s document", async (_label, field) => {
    for (const invalidDocument of [null, false, 0, "", [], {}]) {
      const inputs = await writeInputs();
      await writeFile(inputs[field], JSON.stringify(invalidDocument), "utf8");
      const result = await verifyInputs(inputs);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects extra private-record fields and a remote workspace self-attestation", async () => {
    const inventory = privateInventory();
    inventory.unexpectedCredentialLikeValue = "not-allowed";
    inventory.roots[0].workspace.executionMode = "remote";
    const result = await verify({ inventory });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("unsupported field unexpectedCredentialLikeValue");
    expect(result.errors.join("\n")).toContain("must use separately verified local execution");
  });

  it("rejects a private review input that resolves into any Git worktree", async () => {
    const inputs = await writeInputs();
    const result = await verifySavedPlan({
      projectRoot,
      rootName: "preview",
      sourceCommit,
      environment: {},
      terraformIdentity: { version: "1.16.5", binarySha256: sha("e") },
      terraformShowJson: async () => readFile(inputs.planJsonPath, "utf8"),
      ...inputs,
      planJsonPath: path.join(projectRoot, "package.json"),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("outside every Git worktree before inspection");
  });

  it("keeps both private artifact schemas closed around the runtime-accepted records", async () => {
    const inventorySchema = JSON.parse(await readFile(path.join(projectRoot, "infra", "schemas", "private-runtime-inventory.schema.json"), "utf8"));
    const approvalSchema = JSON.parse(await readFile(path.join(projectRoot, "infra", "schemas", "plan-approval.schema.json"), "utf8"));

    expect(inventorySchema.additionalProperties).toBe(false);
    expect(inventorySchema.$defs.workspace.additionalProperties).toBe(false);
    expect(inventorySchema.$defs.githubResource.additionalProperties).toBe(false);
    expect(approvalSchema.additionalProperties).toBe(false);
    expect(approvalSchema.properties.workspace.additionalProperties).toBe(false);
    expect(approvalSchema.required).toEqual(expect.arrayContaining(["providers", "workspace"]));
  });

  it("accepts runtime-valid private records in their schemas and rejects schema-only drift", async () => {
    const inputs = await writeInputs();
    const inventory = JSON.parse(await readFile(inputs.inventoryPath, "utf8"));
    const approval = JSON.parse(await readFile(inputs.approvalPath, "utf8"));

    expect(await validatePrivateRecordSchemas({ projectRoot, inventory, approval })).toEqual([]);

    inventory.collectedAt = "not-a-timestamp";
    approval.workspace.unexpectedField = "not-permitted";
    const errors = await validatePrivateRecordSchemas({ projectRoot, inventory, approval });
    expect(errors.join("\n")).toContain("collectedAt");
    expect(errors.join("\n")).toContain("unexpectedField");
  });
});
