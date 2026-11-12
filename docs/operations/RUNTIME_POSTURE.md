# Manual runtime posture observation

`npm run posture:check` is a standalone, manual, read-only observation. It does not deploy, change a provider control, authenticate to Cloudflare, complete a challenge, send a contact request, or prove provider ownership. It is not integrated into CI or an automation. The command observes only the production apex, production Pages root, stable develop preview alias, canonical `www` redirect, and exact GitHub repository and governance endpoints. It makes bounded GET or HEAD requests, never follows redirects, reads at most 128 KiB per response, and applies an eight-second deadline to the entire request including its body. The metadata read uses no-cache headers and a unique query. `www` Location is inspected only for the exact apex URL; it is not followed.

From a trusted local checkout with Node 22, run:

```sh
npm run posture:check
npm run posture:check -- --expected-commit <40-character-lowercase-sha>
```

The optional expected SHA applies to all three content identities, so compare targets separately in the private evidence when their expected revisions differ. Each target's public schema and cache policy, static headers, and both contact Function GET and HEAD responses are checked separately. A successful Function method check requires 405 and `Allow: POST` for each method; the static and Function CSPs have distinct expectations. A preview returning public HTTP 200 records accessibility, not a breach or an adopted access-control requirement. Any missing or malformed response is unavailable; a failed expected check is fail. Either produces a nonzero exit. A passing response is only a point-in-time observation, not an endorsement of all CSP directives, all routes, live account settings, or future behavior.

For authenticated GitHub ruleset bypass and classic main-protection readback, provide an operator-owned, fine-grained `GH_TOKEN` with repository administration read permission, only on a trusted local machine. Never use credentials from an untrusted pull request. The command refuses a token when `CI` or `GITHUB_ACTIONS` is set, sends it only to the three fixed `api.github.com` paths, and never follows redirects. Without sufficient access, bypass and classic protection report unavailable, not pass. Repository metadata and the active exact-ref ruleset are observed separately from classic main's required pull-request policy, strict `verify` check from Actions app 15368, admin enforcement, deletion and force-push settings. A passing ruleset does not establish its bypass list unless the authenticated repository response reports admin permission and the ruleset response includes the bypass list. This is a bounded read, not proof of every GitHub setting or environment approval.

Console output contains check names, statuses, and counts only. To retain bounded raw response headers and bodies, create an operator-owned private directory outside every Git worktree, and choose a new absolute file path:

```sh
mkdir -m 700 /absolute/private/posture-evidence
npm run posture:check -- --evidence /absolute/private/posture-evidence/observation.json
```

The existing directory must be owned by the operator with mode 0700, have no symlink components, and lie outside a Git worktree; the output is exclusively created with mode 0600. Protect and eventually remove this artifact through local operator practice: it can contain provider response text, CSP hashes, and private GitHub metadata. It is never written by default. Results intentionally suppress remote errors and raw response content on the console. Do not paste evidence or credentials into issues, PRs, logs, or chat.

## Reconciliation after observation

A historical observation found the stable develop preview behind production. Compare a fresh private observation with the trusted branch revision, reviewed release artifact and CI run; determine whether the preview is deliberately stale before planning a separately authorized deployment. Inspect redirect behavior at the provider and verify it again after any separately approved configuration change. Do not infer the deployed state from checked-in headers alone.

Recheck GitHub governance, repository security features, and environment settings through appropriately scoped read-only operator access; a source fixture does not establish live enforcement. Retain detailed account observations and any pending configuration decisions privately outside Git worktrees. Decide any activation or changes separately with the repository owner. Inspect Cloudflare account, WAF, project, secret, and access-control posture through an authorized operator session and record only necessary private evidence. The Terraform ownership preparation remains inactive; neither this tool nor source configuration proves adoption. Future private-preview access needs its own design, prerequisites, authorization, and verification; this observation does not create such a requirement or activate it.
