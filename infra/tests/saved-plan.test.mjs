import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { configurationDigest, inspectCleanSource, lockDigest, verifySavedPlan } from "../saved-plan.mjs";

const execFile = promisify(execFileCallback);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceCommit = "a".repeat(40);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const policyEvaluator = async ({ state, plan }) => ({ state, reviewedResourceCount: plan.resource_changes.length });

function plan() {
  return {
    format_version: "1.2", terraform_version: "1.16.5", complete: true, errored: false, applyable: false,
    planned_values: { root_module: { resources: [] } },
    resource_changes: [{
      address: "github_repository_ruleset.permanent_branches", provider_name: "registry.terraform.io/integrations/github",
      change: {
        actions: ["no-op"], after_unknown: {}, after: {
          id: "ruleset-private-id", repository: "Smart-Porfolio", name: "protect-permanent-branches", target: "branch", enforcement: "active", bypass_actors: [],
          conditions: [{ ref_name: [{ include: ["refs/heads/main", "refs/heads/develop"], exclude: [] }] }], rules: [{ deletion: true, non_fast_forward: true }]
        }
      }
    }]
  };
}

function inventory() {
  return {
    schemaVersion: 1,
    state: "github-governance",
    repository: "nicolasgioanni/Smart-Porfolio",
    repositoryId: "private-repository-id",
    resources: { "github_repository_ruleset.permanent_branches": "ruleset-private-id" }
  };
}

function previewPlan() {
  const accountId = "0123456789abcdef0123456789abcdef";
  const addresses = [
    "cloudflare_d1_database.contact_rate_limit",
    "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities",
    "module.preview_access.cloudflare_zero_trust_access_application.preview",
    "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth",
    "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth"
  ];
  return {
    format_version: "1.2", terraform_version: "1.16.5", complete: true, errored: false, applyable: false,
    variables: { cloudflare_account_id: { value: accountId } }, planned_values: { root_module: { resources: [] } },
    resource_changes: addresses.map((address, index) => ({ address, provider_name: "registry.terraform.io/cloudflare/cloudflare", change: { actions: ["no-op"], after_unknown: {}, after: { id: `private-preview-${index}`, account_id: accountId } } }))
  };
}

function previewInventory() {
  const value = previewPlan();
  return {
    schemaVersion: 1, state: "cloudflare-preview", accountId: "0123456789abcdef0123456789abcdef",
    resources: Object.fromEntries(value.resource_changes.map((change) => [change.address, change.change.after.id]))
  };
}

async function inputs(options = {}) {
  const state = options.state ?? "github-governance";
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-saved-plan-"));
  const savedPlanPath = path.join(directory, "review.tfplan");
  const planJsonPath = path.join(directory, "review.json");
  const approvalPath = path.join(directory, "approval.json");
  const inventoryPath = path.join(directory, "inventory.json");
  const document = options.planValue === undefined ? plan() : options.planValue;
  options.mutatePlan?.(document);
  const rendered = typeof document === "string" ? document : `${JSON.stringify(document)}\n`;
  const privateInventory = options.inventoryValue === undefined ? inventory() : options.inventoryValue;
  options.mutateInventory?.(privateInventory);
  const renderedInventory = typeof privateInventory === "string" ? privateInventory : JSON.stringify(privateInventory);
  await writeFile(savedPlanPath, "opaque saved plan bytes\n");
  await writeFile(planJsonPath, rendered);
  await writeFile(inventoryPath, renderedInventory);
  const approval = options.approvalValue === undefined ? {
    schemaVersion: 2, state, sourceCommit,
    configurationDigest: await configurationDigest(projectRoot, state),
    lockDigest: await lockDigest(projectRoot, state),
    inventoryDigest: sha256(renderedInventory),
    planDigest: sha256(rendered), savedPlanDigest: sha256("opaque saved plan bytes\n"),
    terraform: { version: "1.16.5", binarySha256: "b".repeat(64) },
    workspace: { id: "ws-private", stateVersionId: "sv-private", lineage: "lineage-private", serial: 1 }
  } : options.approvalValue;
  if (approval && typeof approval === "object") options.mutateApproval?.(approval);
  await writeFile(approvalPath, typeof approval === "string" ? approval : JSON.stringify(approval));
  return { directory, savedPlanPath, planJsonPath, approvalPath, inventoryPath, rendered, state };
}

async function verify(options = {}) {
  const files = await inputs(options);
  try {
    return await verifySavedPlan({
      projectRoot, state: options.state ?? "github-governance", sourceCommit, ...files,
      terraformIdentity: { version: "1.16.5", binarySha256: "b".repeat(64) },
      terraformShowJson: async () => options.regenerated ?? files.rendered,
      planEvaluator: options.planEvaluator ?? policyEvaluator,
      sourceInspector: options.sourceInspector ?? (async () => ({ sourceCommit })),
      environment: options.environment ?? {}
    });
  } finally { await rm(files.directory, { recursive: true, force: true }); }
}

test("binds an exact reviewed no-op permanent-branch plan to its private inventory and canonical policy evaluator", async () => {
  let invocation;
  const result = await verify({
    planEvaluator: async (value) => { invocation = value; return policyEvaluator(value); }
  });
  assert.equal(result.ok, true);
  assert.equal(result.reviewBinding.state, "github-governance");
  assert.equal(invocation.state, "github-governance");
  assert.equal(invocation.plan.resource_changes.length, 1);
});

test("rejects destructive, import, replacement, unknown, stale, and expanded governance plans", async () => {
  for (const mutatePlan of [
    (value) => { value.resource_changes[0].change.actions = ["delete"]; },
    (value) => { value.resource_changes[0].change.importing = { id: "private" }; },
    (value) => { value.resource_changes[0].change.replace_paths = [["name"]]; },
    (value) => { value.resource_changes[0].change.after_unknown = { name: true }; },
    (value) => { value.resource_changes[0].change.after.conditions[0].ref_name[0].include = ["refs/heads/main"]; },
    (value) => { value.resource_changes[0].change.after.conditions.push({ repository_name: [{ include: ["*"], exclude: [] }] }); },
    (value) => { value.resource_changes[0].change.after.rules.push({ deletion: false, non_fast_forward: false, pull_request: [{ required_approving_review_count: 1 }] }); },
    (value) => { value.resource_changes[0].change.after.bypass_actors.push({ actor_id: 1, actor_type: "RepositoryRole", bypass_mode: "always" }); }
  ]) {
    const result = await verify({ mutatePlan });
    assert.equal(result.ok, false);
  }
});

test("rejects null or malformed plan and approval JSON instead of treating either as absent", async () => {
  const nullPlan = await verify({ planValue: "null\n" });
  assert.equal(nullPlan.ok, false);
  assert.match(nullPlan.errors.join("\n"), /Terraform show JSON must be an object/);

  const nullApproval = await verify({ approvalValue: "null" });
  assert.equal(nullApproval.ok, false);
  assert.match(nullApproval.errors.join("\n"), /approval.*object/i);
});

test("rejects a non-text regenerated show result, a changed result, and Terraform command overrides", async () => {
  const nonText = await verify({ regenerated: { rendered: "not text" } });
  assert.equal(nonText.ok, false);
  assert.match(nonText.errors.join("\n"), /did not return rendered JSON text/);

  const changed = await verify({ regenerated: "{}\n" });
  assert.equal(changed.ok, false);
  assert.match(changed.errors.join("\n"), /does not exactly match/);

  const overridden = await verify({ environment: { TF_CLI_ARGS_plan: "-destroy", TF_WORKSPACE: "other" } });
  assert.equal(overridden.ok, false);
  assert.match(overridden.errors.join("\n"), /TF_CLI_ARGS_plan/);

  const staleSource = await verify({ sourceInspector: async () => ({ sourceCommit: "c".repeat(40) }) });
  assert.equal(staleSource.ok, false);
  assert.match(staleSource.errors.join("\n"), /does not match the clean checkout/);
});

test("rejects inventory identity mismatches and approvals that do not bind the inventory digest", async () => {
  const changedId = await verify({ mutatePlan: (value) => { value.resource_changes[0].change.after.id = "different-private-id"; } });
  assert.equal(changedId.ok, false);
  assert.match(changedId.errors.join("\n"), /resource IDs do not match/);

  const badRepository = await verify({ mutateInventory: (value) => { value.repository = "other/repository"; } });
  assert.equal(badRepository.ok, false);
  assert.match(badRepository.errors.join("\n"), /GitHub repository/);

  const staleInventoryDigest = await verify({ mutateApproval: (value) => { value.inventoryDigest = "0".repeat(64); } });
  assert.equal(staleInventoryDigest.ok, false);
  assert.match(staleInventoryDigest.errors.join("\n"), /inventory/);
});

test("requires the private Cloudflare inventory to bind the concrete plan account and physical resource IDs", async () => {
  const wrongAccount = await verify({
    state: "cloudflare-preview", planValue: previewPlan(), inventoryValue: { ...previewInventory(), accountId: "f".repeat(32) }
  });
  assert.equal(wrongAccount.ok, false);
  assert.match(wrongAccount.errors.join("\n"), /Cloudflare account/);
});

test("rejects linked private inputs and sanitizes canonical policy failures", async () => {
  const files = await inputs();
  const linkedInventory = path.join(files.directory, "linked-inventory.json");
  await symlink(files.inventoryPath, linkedInventory);
  try {
    const linked = await verifySavedPlan({
      projectRoot, state: "github-governance", sourceCommit, ...files, inventoryPath: linkedInventory,
      terraformIdentity: { version: "1.16.5", binarySha256: "b".repeat(64) }, terraformShowJson: async () => files.rendered,
      planEvaluator: policyEvaluator, sourceInspector: async () => ({ sourceCommit }), environment: {}
    });
    assert.equal(linked.ok, false);
    assert.match(linked.errors.join("\n"), /private resource inventory must be a bounded regular file/);
  } finally { await rm(files.directory, { recursive: true, force: true }); }

  const rejected = await verify({ planEvaluator: async () => { throw new Error("credential=private-value"); } });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.errors, ["canonical Terraform plan policy evaluation failed"]);
});

async function temporaryConfiguration() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-configuration-"));
  const state = path.join(directory, "infra", "states", "cloudflare-preview");
  const module = path.join(directory, "infra", "modules", "access");
  await mkdir(state, { recursive: true });
  await mkdir(module, { recursive: true });
  await writeFile(path.join(state, "main.tf"), 'terraform { backend "remote" {} }\nmodule "access" { source = "../../modules/access" }\n');
  await writeFile(path.join(state, ".terraform.lock.hcl"), "provider lock\n");
  await writeFile(path.join(module, "main.tf"), "output \"name\" { value = \"first\" }\n");
  await writeFile(path.join(module, ".terraform.lock.hcl"), "module lock\n");
  return { directory, state, module };
}

test("configuration digest closes over referenced modules and rejects overrides and symlinks", async () => {
  const fixture = await temporaryConfiguration();
  try {
    const original = await configurationDigest(fixture.directory, "cloudflare-preview");
    const originalLocks = await lockDigest(fixture.directory, "cloudflare-preview");
    await writeFile(path.join(fixture.module, "main.tf"), "output \"name\" { value = \"changed\" }\n");
    assert.notEqual(await configurationDigest(fixture.directory, "cloudflare-preview"), original);
    assert.equal(await lockDigest(fixture.directory, "cloudflare-preview"), originalLocks);
    await writeFile(path.join(fixture.module, ".terraform.lock.hcl"), "changed module lock\n");
    assert.notEqual(await lockDigest(fixture.directory, "cloudflare-preview"), originalLocks);

    await writeFile(path.join(fixture.state, "override.tf"), "resource \"x\" \"y\" {}\n");
    await assert.rejects(configurationDigest(fixture.directory, "cloudflare-preview"), /configuration closure is invalid/);
    await rm(path.join(fixture.state, "override.tf"));
    await writeFile(path.join(fixture.state, "backend.hcl"), "organization = \"unexpected\"\n");
    await assert.rejects(configurationDigest(fixture.directory, "cloudflare-preview"), /configuration closure is invalid/);
    await rm(path.join(fixture.state, "backend.hcl"));
    await writeFile(path.join(fixture.state, "extra.tf"), 'module "unsafe" { source = "../../../elsewhere" }\n');
    await assert.rejects(configurationDigest(fixture.directory, "cloudflare-preview"), /configuration closure is invalid/);
    await rm(path.join(fixture.state, "extra.tf"));
    await writeFile(path.join(fixture.state, "unsupported.tf.json"), "{}\n");
    await assert.rejects(configurationDigest(fixture.directory, "cloudflare-preview"), /configuration closure is invalid/);
    await rm(path.join(fixture.state, "unsupported.tf.json"));
    await symlink(path.join(fixture.module, "main.tf"), path.join(fixture.state, "linked.tf"));
    await assert.rejects(configurationDigest(fixture.directory, "cloudflare-preview"), /configuration closure is invalid/);
  } finally { await rm(fixture.directory, { recursive: true, force: true }); }
});

test("clean-source inspection requires an exact committed and unmodified Git checkout", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-clean-source-"));
  try {
    await execFile("git", ["init", "--quiet", directory]);
    await execFile("git", ["-C", directory, "config", "user.email", "tests@example.invalid"]);
    await execFile("git", ["-C", directory, "config", "user.name", "Saved plan tests"]);
    await writeFile(path.join(directory, "tracked.txt"), "clean\n");
    await execFile("git", ["-C", directory, "add", "tracked.txt"]);
    await execFile("git", ["-C", directory, "commit", "--quiet", "-m", "fixture"]);
    const inspected = await inspectCleanSource(directory);
    assert.match(inspected.sourceCommit, /^[a-f0-9]{40}$/);
    await writeFile(path.join(directory, "untracked.txt"), "dirty\n");
    await assert.rejects(inspectCleanSource(directory), /clean source checkout/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
