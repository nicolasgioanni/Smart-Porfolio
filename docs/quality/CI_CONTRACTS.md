# CI input and evidence contracts

The contracts under `scripts/ci/` are the validation boundary used by `.github/workflows/ci.yml`. Their unit tests run without GitHub or Cloudflare credentials. They establish repository behavior and local admission evidence; they do not establish a completed hosted run, GitHub protection, Cloudflare state, D1 state, or any activated environment setting.

## Workflow composition

`resolve-candidate` admits only the supported event/ref/workflow combinations before checkout. `prepare-content` creates one plan and, except for obsolete candidates, one snapshot artifact; a full plan also carries browser discovery. Full plans fan out to `quality`, `unit-integration`, two Chromium functional shards, `visual-regression`, `cross-browser`, `build-and-package`, and `export-check`. `build-and-package` emits its ordinary release receipt and a distinct built-output Gitleaks receipt for the same sealed manifest before the release artifact uploads. `security-tools`, `security-scans`, `codeql`, and `infrastructure` fan out from candidate resolution for every plan, while `dependency-review` applies to pull requests.

`verify` requires every plan-required job result and the exact original producer artifacts. Source-security receipts bind directly to the candidate and workflow rather than the content snapshot, so obsolete and unchanged plans still require them. The deploy job runs only for a full, accepted, non-PR plan, and its parsed eligibility expression requires an uncancelled workflow, explicit `verify` success, and the exact `deploy=true` output. This explicit status guard lets an intentionally skipped pull-request-only review remain optional on trusted events without GitHub Actions' implicit skip propagation preventing deployment. The schedule heartbeat is a separate guarded write path and has no acceptance or deployment authority.

`scripts/ci/infrastructure.mjs` discovers every module and state root, rejects missing lockfiles or mock suites, and executes formatting, backend-disabled initialization, validation, mocked plans, saved-plan regressions, and OPA policies with a credential-free child environment. Its source receipt is required independently of content changes. Provider-shaped diagnostics remain private; [infrastructure ownership](../../infra/README.md) describes local reproduction and the separate adoption boundary.

## Candidate and execution plan

`scripts/ci/plan.mjs` accepts only pull requests to `main` or `develop`, pushes to those branches, and scheduled or manual execution of the trusted `main` workflow. Pull requests use the exact event merge revision and template content. GitHub's run-head revision is recorded separately: for a pull request it is the feature head, not the synthetic merge revision that is checked out and tested.

Every candidate records its workflow revision, source revision, triggering revision, run identity and producer attempt. Strings are never treated as truthy booleans. A plan declares its target, source mode, snapshot record digest, required validators, full test tier and two Chromium shards. Parsing recomputes those decisions and rejects contradictory metadata.

`scripts/ci/resolve.mjs` verifies the checked-out revision and workflow ref before content preparation or dependency installation. PR resolution makes no provider request. Trusted branch observations are read-only, bounded, reject redirects and cannot resolve arbitrary branch names. Workflow outputs reject embedded newlines and control characters.

Only an obsolete permanent-branch revision or a validated unchanged deployment comparison produces a no-op. A no-op does not authorize deployment. Scheduled and ordinary manual comparisons require validated deployed-identity evidence; a missing comparison is an error. Forced manual execution bypasses only that comparison. Independent source-security checks and receipts remain required for every plan.

## Content snapshot and artifact identity

`scripts/ci/snapshot.mjs` binds the accepted generated JSON bytes to the semantic content hash, candidate, target, dependency lock digest, public build-input digest and original producer. The content artifact contains exactly the generated public JSON and its snapshot record. Extra files, symlinks, invalid UTF-8, malformed records and mismatched bytes fail before restoration.

A consumer uses the original producer's reference even when that consumer is rerun. Regenerating a snapshot changes its generation digest and invalidates prior dependent receipts. A missing, expired or mismatched artifact requires a full affected rerun. There is no alternate-run or freshly generated fallback.

Artifact references name an exact same-run artifact ID, provider digest, role and producer. Provider metadata is checked against the run-head revision separately from the exact source revision carried by the snapshot. A self-consistent record is input-integrity evidence; trusted release authorization still requires the complete gate and downstream provenance checks.

The artifact transport verifies the downloaded archive's SHA-256 before extraction. It follows only the exact artifact endpoint's signed HTTPS storage location, without forwarding the API token, and rejects further redirects. Missing artifacts, stalled downloads and digest mismatches fail. The standard-library ZIP extractor requires a new destination and bounded regular files; it rejects unsafe paths, links, duplicate or colliding names, encrypted entries and oversized expansion. This keeps the aggregate independent of application dependency installation. GitHub documents the [artifact download redirect](https://docs.github.com/en/rest/actions/artifacts#download-an-artifact) and the [runner storage domains](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

## Browser discovery and terminal evidence

`scripts/ci/receipts.mjs` identifies each browser test by project, relative file, title path and repeat index. Source line numbers do not define identity. The disjoint union of functional shards and visual discovery must equal full discovery. Empty discovery, duplicate tests, new unassigned tests and omitted tests fail.

Each execution receipt matches its plan, snapshot, validator, producer and assigned discovery. It accounts for every assigned case and exposes retries, skips and durations. Existing one-retry behavior is bounded with exact retry indices `0` then optional `1`. A native serial-group retry may repeat a passed case or run a case skipped after another case failed; each terminal case must still pass. Failures, interruptions, missing attempts/cases and unregistered terminal skips cannot become a successful receipt. Optional-content skips require an exact registered identity and reason.

`scripts/ci/browserSkips.mjs` registers only existing optional-workbook cases in Chromium. Changed identities require explicit reconciliation; new skip reasons fail. `scripts/ci/validationEvidence.mjs` creates successful application receipts only after checking the complete assigned execution. Independent security receipts bind to the candidate and workflow, because those scans do not consume the content snapshot. Receipt artifacts contain one bounded JSON record; missing, additional or linked files are rejected.

Evidence files use the shared descriptor-bound regular-file reader: size checks and bounded reads use the same open file, reject a linked final entry, and reject observable changes during the read. The artifact extraction directory remains owned by the isolated job; this helper does not grant trust to an arbitrary parent directory.

`playwright.ci.config.ts` extends the ordinary browser configuration without changing project names, snapshot paths, workers, retries or serial behavior. Visual specifications follow the `*.visual.spec.*` naming contract. Functional discovery includes every other specification automatically. `scripts/ci/browserDiscovery.mjs` invokes native Playwright discovery for the full Chromium suite, two functional shards and the visual selection, and proves exact disjoint coverage. Invalid imports, missing reports and an empty selection fail. `browserReporter.mjs` emits portable test identities and terminal timings without attaching raw errors, absolute paths, environment values or test stdout. HTML and trace diagnostics remain separate from acceptance evidence.

For partial reruns, the gate examines the latest execution of each named job within the same run, including failed or cancelled executions. It never selects an older successful execution to replace a newer failure. Unknown, missing, ambiguous or incomplete evidence blocks acceptance.

`githubEvidence.mjs` admits only bounded, read-only GitHub Actions API responses for this repository and rejects redirects. It verifies the run's event, workflow path, run-head revision and attempt, then reads every page of job/artifact evidence. Matrix evidence uses an exact immutable name containing the original producer run, attempt, role and validator; the unique match becomes an artifact-ID reference. It never uses wildcard selection or a latest-successful fallback. Consumer-only reruns keep the original producer reference; a newer producer execution with missing evidence requires a full affected rerun.

## Sealed deployment admission

The deploy path restores the sealed release from its original immutable reference, verifies the release and archive digest, and binds its manifest producer to the accepted plan. GitHub provenance and SBOM attestations are created for that archive before the deployment command performs its bounded Pages-project preflight; the command then verifies those attestations against the repository, trusted workflow certificate/ref, source and signer digests, and GitHub OIDC issuer. Missing credentials, malformed attestations, changed bytes, or a changed producer fail before a provider mutation.

Each target has a non-cancelling deployment lock. Deployment checks branch freshness before and after the selected D1 migration, verifies the sealed directory again, and accepts only the known structured JSONL records emitted by Wrangler `4.148.0`. It smokes the returned unique deployment host and verifies its exact identity before smoking the stable assigned origin and comparing final identity. A post-upload failure does not imply that no candidate is serving and does not invoke automatic rollback.

Wrangler's configuration cache is directed to a private sibling of the sealed directory. Provider commands may write cache and diagnostic state there, but any added or changed release file still fails integrity verification.

## Validation ownership

The colocated `plan.test.mjs`, `snapshot.test.mjs`, `receipts.test.mjs`, `gate.test.mjs`, `runner.test.mjs`, and `deployment.test.mjs` cover event decisions, malformed metadata, source and application receipts, unsafe snapshots, artifact substitution, producer/consumer reruns, coverage partitions, sealed release and deployment ordering. `workflowGraph.mjs` validates parsed job responsibilities and dependencies without constraining job order or setup counts. Its tests reject missing gate edges, disconnected validators, incomplete shards and unsafe cancellation, and normalize every YAML trigger representation before applying the event allowlist. YAML and workflow-contract tests establish the checked-in wiring; a hosted run is still needed to validate runner, permission, action, attestation, and provider integration. Fixtures do not prove live branch protections, environment approvals, or provider configuration.

The locked `yaml` development dependency supports semantic parsing through `workflowYaml.mjs`. YAML 1.2 preserves GitHub's `on` key; duplicate keys, malformed aliases, unexpected tags and oversized inputs fail. Parsing is used by local/CI contract checks, not by the lightweight result gate.

## Timing observation

The always-run timing step records sanitized job and step durations for setup, combined snapshot download/extract/verification, immutable uploads, content and discovery work, and accepted browser receipts. It reports shard test, retry, and skip counts plus all-attempt and current-attempt runner minutes. Missing measurements remain unknown. The step is advisory: it neither changes acceptance nor estimates billing, and only exact gate outputs authorize release behavior.

Keep two Chromium functional shards until three comparable full trials show at least a 15% median gate improvement with no more than 25% runner-minute growth. Only then may a separately reviewed change consider three or four shards.

## Source-audit placement

Security scans run the dependency audit for every candidate, including unchanged scheduled candidates. Its advisory and exception-expiry decision remains blocking in that source-security job; quality validation does not replace the receipt.
