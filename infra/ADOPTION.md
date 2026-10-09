# Terraform adoption and activation

Terraform is not active for this repository. No resource has been imported or applied, no HCP Terraform backend is configured in these roots, and no workflow can apply infrastructure. This document describes the review boundary for a future separately authorized activation; it does not authorize one.

## Preconditions

Before any import or plan, an authorized operator must collect evidence outside every Git worktree. The evidence must come from authenticated sources, not from the tracked manifest or a self-attested private JSON file:

1. Resolve the clean exact source commit and hash each selected root configuration and lock file.
2. Query the intended HCP Terraform workspace by immutable ID and name; verify its organization, project, local execution mode, current state-version ID, lineage, serial, lock behavior, and state-protection posture.
3. Pull the state through the selected backend and bind its digest, then compare every state address and resource ID with the authenticated provider inventory.
4. Query the Cloudflare account and each D1 tenant/environment through exact authenticated APIs. Query the GitHub owner, repository, and existing permanent-branch ruleset through their exact resource APIs.
5. Confirm that each resource has exactly one root, no state address crosses an environment, and no unowned or duplicate resource is present.

The provider identity, state, and workspace checks above remain activation blockers until independently verified. The offline guard can compare supplied records but cannot establish that evidence itself.

## Proposed adoption sequence

The only intended future Terraform resources are the two existing contact quota D1 containers and the existing active `protect-permanent-branches` GitHub ruleset. Its exact scope is `refs/heads/main` and `refs/heads/develop`, with deletion and non-fast-forward protection and no bypass actors. Existing classic main protection remains externally managed.

If activation is separately approved, perform one root at a time with an exact reviewed resource ID. Keep Terraform operational data outside the repository, use native provider credential environment variables, and do not place credentials in `.tfvars`, source, state copies, or review records. After a separately authorized import, require a fresh plan with detailed exit code zero and verify that every managed resource is a no-op. A no-op plan alone does not prove ownership.

The D1 roots use `prevent_destroy`; they do not own SQL migrations. The release workflow remains the only owner of append-only migration application. The GitHub root uses `prevent_destroy`, covers the two permanent refs, and must never add bypass actors or broaden rules without a dedicated review.

## Saved-plan review boundary

Before a future authorized action, capture `terraform show -json` from the exact saved plan with the pinned Terraform binary and bind both the binary plan digest and JSON digest in a private approval record. Bind the record to the clean source commit, root configuration digest, lock digest, private inventory digest, provider versions, workspace immutable identity, state-version ID, lineage, serial, and provider account or repository identity.

Run the offline guard immediately before the action. It must reject a stale source or state binding, changed lock/configuration, missing inventory, malformed or incomplete plan, unknown value, import, delete, replacement, provider alias, cross-root reference, wrong environment, or unowned address. Repeat authenticated provider, workspace, state, and branch-tip checks immediately before the authorized action. No automatic apply workflow is permitted.

## Current blockers

- Cloudflare Pages adoption is intentionally absent because its secret-variable import limitation has not been resolved; never remove live secrets to make an import work.
- HCP Terraform workspace execution and state-protection posture have not been independently verified by this repository, so the offline guard cannot clear them.
- Provider entitlement, exact live IDs, and state evidence are private operational facts and must be reviewed outside Git before activation.
