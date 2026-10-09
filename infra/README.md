# Terraform ownership configuration

This directory is a proposed ownership configuration. It contains no backend settings, provider credentials, Terraform state, HCP Terraform workspace identifiers, resource IDs, plans, imports, or apply automation. The current repository state is **zero Terraform resources imported, applied, or activated**.

The authoritative safety procedure is [adoption and activation](ADOPTION.md). The broader contract, evidence boundary, and guard behavior are in the [Terraform ownership guide](../docs/infrastructure/TERRAFORM_OWNERSHIP.md).

## Roots and ownership

Each root is independent. No root reads another root's state, declares a backend, or uses provider aliases.

| Root | Scope | Managed address after separately authorized adoption | Current status |
| --- | --- | --- | --- |
| `shared` | Reserved account-wide scope | None | No managed resources |
| `preview` | Preview contact quota D1 container | `cloudflare_d1_database.contact_rate_limit` | Exact-ID adoption required |
| `production` | Production contact quota D1 container | `cloudflare_d1_database.contact_rate_limit` | Exact-ID adoption required |
| `github-governance` | Existing permanent-branch rule | `github_repository_ruleset.permanent_branches` | Exact-ID adoption required |

The tracked [logical ownership manifest](ownership-manifest.json) is a policy input, not live evidence. It assigns one future owner to each address and keeps SQL migrations with the existing release workflow. Provider versions are pinned to Cloudflare `5.27.0` and GitHub `6.13.0`; every root has its own checked-in lock file. The ownership checker requires the reviewed provider source, exact constraint, and exact checksum set in each lock. Do not regenerate or edit a lock as part of review; any provider change needs a separate reviewed update.

## Private operational records

Private runtime inventory, provider responses, HCP Terraform workspace/state evidence, saved plans, `terraform show -json` output, and approval records must remain **outside every Git worktree**. Do not create an ignored private-record directory inside this repository. The tracked schemas describe the required private record shape without including values:

- [private runtime inventory schema](schemas/private-runtime-inventory.schema.json)
- [saved-plan approval schema](schemas/plan-approval.schema.json)

An operator-supplied inventory can help the offline guard reject mismatched addresses, environments, resource IDs, state lineage, serials, or review bindings. It cannot prove that a Cloudflare account, GitHub repository, HCP Terraform workspace, or Terraform state is live and correct. A future authorized operation must derive that evidence from authenticated provider APIs and Terraform state, then refresh mutable facts immediately before any action.

## Offline checks

Run these offline, credential-free repository checks before review:

```bash
npm run infrastructure:check
npm run test:infrastructure
```

`scripts/terraform/safePlanGuard.mjs` can capture deterministic `terraform show -json` output from an existing saved plan and verify it against an external approval record. During verification it inspects the pinned Terraform binary, reruns the read-only show command from that exact saved plan in memory, and requires the reviewed JSON digest to match. It rejects trace-output environment variables, imports, destroys, replacements, unknown values, failed or unknown checks, cross-root addresses, stale bindings, and command overrides. It never runs `import` or `apply`, and a passing result is not authorization to run either.

## External review artifacts

The examples below are an operator procedure, not repository configuration. `TERRAFORM_SOURCE_ROOT` selects the clean checked-out Git worktree. The Terraform binary, private review directory, Terraform data directory, saved plan, emitted JSON, inventory, and approval record must be absolute paths outside every Git worktree. `TF_EXPECTED_TERRAFORM_SHA256` is the approved private 64-character lowercase hexadecimal digest for that binary. None of the private artifacts or digest belongs in `infra/`, an ignored repository directory, or a commit.

```bash
: "${TERRAFORM_SOURCE_ROOT:?set the clean checked-out source root}"
: "${TERRAFORM_1_16_5_BIN:?set the reviewed absolute Terraform 1.16.5 binary path}"
: "${TF_EXPECTED_TERRAFORM_SHA256:?set the approved private SHA-256 for that binary}"
: "${TF_REVIEW_DIR:?set the external private review directory}"
: "${TF_DATA_DIR:?set the external Terraform data directory}"
: "${TF_SAVED_PLAN:?set the external saved-plan path}"
: "${TF_PLAN_JSON:?set the external terraform-show JSON path}"
: "${TF_RUNTIME_INVENTORY:?set the external private runtime-inventory path}"
: "${TF_PLAN_APPROVAL:?set the external private approval-record path}"

case "$TERRAFORM_SOURCE_ROOT" in /*) ;; *) printf '%s\n' "the source root must be absolute" >&2; exit 1 ;; esac
for private_path in "$TERRAFORM_1_16_5_BIN" "$TF_REVIEW_DIR" "$TF_DATA_DIR" "$TF_SAVED_PLAN" "$TF_PLAN_JSON" "$TF_RUNTIME_INVENTORY" "$TF_PLAN_APPROVAL"; do
  case "$private_path" in /*) ;; *) printf '%s\n' "private Terraform paths must be absolute" >&2; exit 1 ;; esac
done
test "${#TF_EXPECTED_TERRAFORM_SHA256}" -eq 64 && printf '%s' "$TF_EXPECTED_TERRAFORM_SHA256" | grep -Eq '^[0-9a-f]{64}$' || { printf '%s\n' "the expected Terraform digest must be 64 lowercase hexadecimal characters" >&2; exit 1; }
test -x "$TERRAFORM_1_16_5_BIN" || { printf '%s\n' "the reviewed Terraform binary must be executable" >&2; exit 1; }
actual_terraform_sha256="$(shasum -a 256 "$TERRAFORM_1_16_5_BIN" | awk '{print $1}')" || { printf '%s\n' "could not calculate the Terraform binary digest" >&2; exit 1; }
test "$actual_terraform_sha256" = "$TF_EXPECTED_TERRAFORM_SHA256" || { printf '%s\n' "the Terraform binary digest does not match the approved private digest" >&2; exit 1; }
cd "$TERRAFORM_SOURCE_ROOT"
test -z "$(git status --porcelain)" || { printf '%s\n' "Terraform review requires a clean HEAD" >&2; exit 1; }
export TF_DATA_DIR
```

Capture the review JSON from the existing saved plan, then retain the command's JSON output with the private approval record. The guard checks the binary is absolute, outside every Git worktree, and reports its inspected digest; the approval record must bind that reported digest as well as the separately checked private expected digest.

```bash
"$TERRAFORM_1_16_5_BIN" version -json
node scripts/terraform/safePlanGuard.mjs show \
  --terraform "$TERRAFORM_1_16_5_BIN" \
  --saved-plan "$TF_SAVED_PLAN" \
  --plan-json "$TF_PLAN_JSON"
```

After the authorized operator has created the private inventory and approval record from the same clean commit and plan bytes, verify the selected ownership root. `TF_DATA_DIR` remains exported so the guard can reject a worktree-local Terraform data directory before it starts Terraform; neither command imports or applies.

```bash
node scripts/terraform/safePlanGuard.mjs verify \
  --root "${TF_OWNERSHIP_ROOT:?set one reviewed root name}" \
  --terraform "$TERRAFORM_1_16_5_BIN" \
  --saved-plan "$TF_SAVED_PLAN" \
  --plan-json "$TF_PLAN_JSON" \
  --inventory "$TF_RUNTIME_INVENTORY" \
  --approval "$TF_PLAN_APPROVAL"
```
