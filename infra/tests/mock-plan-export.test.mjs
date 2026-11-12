import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import process from "node:process";
import test from "node:test";
import { evaluatePlan } from "../check-plan.mjs";
import { auditCollectorSeal } from "./plan-fixtures.mjs";

const terraform = process.env.TERRAFORM_BIN ?? "terraform";
const opa = process.env.OPA_BIN;
const OMIT = Symbol("computed provider value");
const eventCache = new Map();

function mockPlanEvents(state = "cloudflare-preview") {
  if (eventCache.has(state)) return eventCache.get(state);
  const output = execFileSync(terraform, [
    `-chdir=infra/states/${state}`,
    "test",
    "-json",
    "-verbose",
    "-no-color",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, TF_CLI_CONFIG_FILE: "/dev/null" },
    maxBuffer: 20 * 1024 * 1024,
  });
  const events = output.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  eventCache.set(state, events);
  return events;
}

function knownProviderValues(value, unknown) {
  if (unknown === true) return OMIT;
  if (unknown === false || unknown === undefined) return value;
  if (Array.isArray(unknown)) {
    if (!Array.isArray(value)) return value;
    return value.map((entry, index) => {
      const known = knownProviderValues(entry, unknown[index]);
      return known === OMIT ? null : known;
    });
  }
  if (!unknown || typeof unknown !== "object" || !value || typeof value !== "object" || Array.isArray(value)) return value;
  const known = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = knownProviderValues(entry, unknown[key]);
    if (normalized !== OMIT) known[key] = normalized;
  }
  return known;
}

function savedPlanFromProviderEvent(state, event) {
  const resourceChanges = event.test_plan.resource_changes;
  return {
    format_version: event.test_plan.plan_format_version,
    terraform_version: "1.16.5",
    ...(state.startsWith("cloudflare-") ? { variables: { cloudflare_account_id: { value: "0123456789abcdef0123456789abcdef" } } } : {}),
    planned_values: {
      root_module: {
        resources: resourceChanges.map((change) => ({
          address: change.address,
          mode: change.mode,
          type: change.type,
          name: change.name,
          provider_name: change.provider_name,
          values: knownProviderValues(change.change.after, change.change.after_unknown),
        })),
      },
    },
    resource_changes: resourceChanges,
  };
}

test("Terraform mock-plan export retains the provider values and computed Access policy reference shape", () => {
  const event = mockPlanEvents().find((candidate) => candidate.type === "test_plan");
  assert.ok(event, "terraform test -json -verbose must emit a test_plan event");
  const plan = event.test_plan;
  assert.equal(plan.plan_format_version, "1.2");
  assert.ok(Array.isArray(plan.resource_changes));

  const accessApplication = plan.resource_changes.find((change) => change.address === "module.preview_access.cloudflare_zero_trust_access_application.preview");
  const accessPolicy = plan.resource_changes.find((change) => change.address === "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities");
  const serviceApplication = plan.resource_changes.find((change) => change.address === "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth");
  const servicePolicy = plan.resource_changes.find((change) => change.address === "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth");
  const database = plan.resource_changes.find((change) => change.address === "cloudflare_d1_database.contact_rate_limit");

  assert.deepEqual(database.change.actions, ["create"]);
  assert.equal(database.change.after.name, "smart-portfolio-contact-rate-limit-preview");
  assert.equal(accessApplication.change.after.type, "self_hosted");
  assert.equal(accessApplication.change.after.allow_authenticate_via_warp, false);
  assert.equal(accessApplication.change.after.auto_redirect_to_identity, true);
  assert.equal(accessApplication.change.after.options_preflight_bypass, false);
  assert.equal(accessApplication.change.after.policies[0].precedence, 1);
  assert.equal(accessApplication.change.after_unknown.policies[0].id, true);
  assert.equal(accessPolicy.change.after.decision, "allow");
  assert.deepEqual(accessPolicy.change.after.exclude, []);
  assert.deepEqual(accessPolicy.change.after_unknown.exclude, []);
  assert.equal(accessPolicy.change.after.include[0].email.email, "owner@example.com");
  assert.equal(accessPolicy.change.after.require[0].login_method.id, "11111111-1111-1111-1111-111111111111");
  assert.equal(serviceApplication.change.after.domain, "*.smart-portfolio-bds.pages.dev");
  assert.equal(serviceApplication.change.after.zone_id, null);
  assert.equal(serviceApplication.change.after.auto_redirect_to_identity, false);
  assert.equal(serviceApplication.change.after_unknown.policies[0].id, true);
  assert.equal(servicePolicy.change.after.decision, "non_identity");
  assert.deepEqual(servicePolicy.change.after.include[0].service_token, { token_id: "preview-service-token-id" });
  assert.ok(Object.entries(servicePolicy.change.after.include[0]).every(([key, value]) => key === "service_token" || value === null));
  assert.deepEqual(servicePolicy.change.after.exclude, []);
  assert.deepEqual(servicePolicy.change.after.require, []);
});

test("provider mock exports keep computed Access attachments as an explicit activation blocker", () => {
  if (!opa) throw new Error("OPA_BIN must point to the pinned OPA executable for provider-shape plan tests.");
  for (const state of ["cloudflare-shared", "cloudflare-preview", "cloudflare-production", "cloudflare-audit", "github-governance"]) {
    const event = mockPlanEvents(state).find((candidate) => candidate.type === "test_plan");
    assert.ok(event, `${state} must emit a credential-free Terraform mock test_plan event`);
    const input = { state, plan: savedPlanFromProviderEvent(state, event), collectorSeal: state === "cloudflare-audit" ? auditCollectorSeal() : undefined, opa };
    if (state === "cloudflare-preview") {
      assert.throws(() => evaluatePlan(input), /exact human-policy attachment/);
    } else {
      assert.doesNotThrow(() => evaluatePlan(input));
    }
  }
});
