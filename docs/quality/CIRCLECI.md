# CircleCI validation

CircleCI provides additional template-based validation and change-aware test selection. It does not replace the existing GitHub Actions `verify` requirement, authorize deployment, or supply the trusted producer for a sealed production release. The [native CI contracts](CI_CONTRACTS.md) and [deployment boundary](../operations/DEPLOYMENT.md) remain authoritative for those operations.

## Pipeline and selection

`.circleci/config.yml` starts `portfolio-setup`. Its setup script checks the checkout revision, computes a complete Git comparison, and produces a continuation configuration with only the selected jobs. Unknown comparisons, unrecognized paths, empty diffs, protected-branch pushes, tags, and forced or scheduled runs select full validation.

Narrow selection requires a GitHub App push or pull-request event with a same-repository PR URL. A bounded, credential-free GitHub API read must confirm that the PR is open, targets `main` or `develop`, and still has this exact head revision and branch. The comparison uses the PR's actual base SHA. Unavailable metadata, a moved head, forks, or missing local base history select full coverage.

`scripts/circleci/impact.mjs` owns the versioned impact policy. The plan records the base/head revisions, changed paths, trigger, selection reasons, and selected specifications. Consumers recompute the policy before accepting a plan. A rename must include both paths; a deletion includes its old path. Remote workbook updates cannot be classified from Git paths and remain on the existing strict release pipeline.

| Change | CircleCI selection |
| --- | --- |
| Ordinary Markdown documentation | Quality and source-security checks |
| Allowlisted feature implementation or styling | Quality, all unit tests, affected Chromium specifications, build/export, and source-security checks; UI coverage retains skeleton alignment, transitions, and visual comparison |
| Shared UI, global styles, routing, content generation/parsing, dependencies, CI, security or unknown paths | Full validation |
| Security, operations or CI-contract documentation | Full validation |

The targeted browser selection includes shared navigation, accessibility, and progressive-enhancement checks. Full validation retains two functional Chromium shards, the 25 existing Linux visual baselines, Firefox critical, WebKit critical, and mobile WebKit Research/Projects coverage. No baseline bytes, screenshot thresholds, or skeleton specifications change.

`prepare` generates one local-template snapshot and discovers browser assignments. Jobs restore that snapshot and verify the source revision and input hashes. Each selected validator must produce a matching successful receipt. `acceptance` rejects missing, extra, stale, or unsuccessful evidence and records the selected and intentionally unselected checks. An unselected check is not represented as an executed passing test.

CircleCI runs existing source scanners and full-plan dependency audits, plus credential-free infrastructure checks for full plans. GitHub CodeQL, dependency review, native producer receipts, release attestations, and deployment admission remain in GitHub Actions. A successful CircleCI run therefore establishes additional validation, not equivalence to the full production release gate.

## Runtime and reports

Jobs use the pinned Ubuntu 24.04 machine image and Node version declared in the CircleCI configuration. Dependencies come from `package-lock.json`; npm downloads are cached by its checksum. Existing installed Playwright versions determine the browser binaries. Linux screenshots must compare against the existing reviewed baselines with zero difference.

The pipeline uses local templates and does not need a workbook locator, Cloudflare credentials, contact-provider secrets, or a CircleCI personal API token. The setup job uses only CircleCI's built-in continuation credential against its fixed official endpoint. Child validation commands receive a restricted environment.

The export build uses the existing local public Turnstile fixture so the browser test can exercise its mocked provider. It does not inherit production or preview site keys and does not produce a deployable production candidate.

JUnit results and failure-only browser diagnostics are separate from the acceptance summary. Scanner details, environment dumps, source archives, and deployable builds are not uploaded as diagnostic artifacts. Failed audits or tests stay failed; changing providers does not resolve dependency advisories.

## Project setup

The configured project is `Smart-Porfolio` in the `Nicolas Gioanni` CircleCI organization:

- Project slug: `circleci/KQ3AcKmoBm6ME2ewoJjyBd/D2FVgecxDxnu3fC6LxpR1h`.
- Project ID: `615a571b-f722-4eb6-8ec1-c8f58c67c6f0`.
- Pipeline definition: `f62f1de2-ddb7-496e-b8e9-0d8d22441757`.
- Config source and checkout source: `nicolasgioanni/Smart-Porfolio`.
- Config path: `.circleci/config.yml`.

The starting trigger covers PR creation/updates, default-branch pushes, and tags. Confirm these settings in **Project Settings → Project Setup**, and keep the configuration revision aligned with the intended checkout. New projects support dynamic configuration; an absent continuation key must fail setup rather than silently run a different plan.

First validate a complete run and its actual resource usage. Then exercise a known feature-only PR and compare the recorded selection with a full run. The initial CI configuration change itself selects full coverage. A smaller PR selection does not authorize a production release.

## Authenticated GitHub Actions verification

`.github/workflows/circleci-verification.yml` checks CircleCI completion using its authenticated API. It executes verifier code from the repository's trusted default branch, never from the PR being tested. Inputs are data passed through environment variables, not interpolated shell commands.

The verifier binds the exact CircleCI workflow to its project, pipeline, repository URL, and expected Git commit. It requires the `portfolio-validation` workflow, successful validator jobs, and an `acceptance` job depending on the complete job graph. Missing jobs, skipped or approval jobs, malformed pages, stale revisions, redirects, API failures, and timeouts fail verification. This result reports authenticated completion only; it does not replace release provenance or independently prove every test's implementation.

Activation requires these operator steps after the verifier is available on the trusted default branch:

1. Create a CircleCI API credential authorized to read this project's pipeline, workflow, and job metadata. Prefer a dedicated identity with the narrowest available access. CircleCI API v2 personal tokens may carry broader account permissions, so review the actual token scope before granting it.
2. Save the credential as the GitHub Actions repository secret `CIRCLECI_API_TOKEN`. Do not place it in source, CircleCI job variables, a PR, or a chat message. Token creation and transfer require the account owner's explicit approval.
3. Confirm CircleCI's VCS status updates are enabled. A successful `ci/circleci: acceptance` status starts automatic verification. Its target URL must identify this project's exact workflow; a lookalike status alone is not trusted evidence.
4. Alternatively, run **CircleCI completion evidence** manually on `main` or `develop`, supplying the workflow UUID and the exact expected 40-character commit SHA.
5. Confirm a real authenticated positive result and rejection of a mismatched SHA before treating the bridge as operational.

A GitHub account billing lock also prevents this lightweight workflow from running. CircleCI can still execute its independent checks, but no local fixture or CircleCI success establishes that the GitHub bridge ran. Existing branch protections remain in force.

## Local checks and maintenance

Run `npm run test:circleci` for the impact, runner, configuration, and API-verifier contracts. These tests use injected provider boundaries and do not establish hosted execution. Run documentation validation, lint, types, the relevant browser/static-export checks, and the existing broader validation before publication.

Use the official CircleCI CLI to run `circleci config validate .circleci/config.yml`, and validate a generated full continuation configuration as well. Keep the selector, emitted jobs, receipt acceptance, API-verifier job allowlist, tests, and this guide synchronized. The owning [validation specialist](../../.agents/skills/portfolio-validation/SKILL.md) and [skeleton specialist](../../.agents/skills/portfolio-skeleton-regression/SKILL.md) still apply.

Provider references: [dynamic configuration](https://circleci.com/docs/guides/orchestrate/using-dynamic-configuration/), [API v2](https://circleci.com/docs/api/v2/), [status updates](https://circleci.com/docs/guides/integration/status-updates/), and [test reporting](https://circleci.com/docs/guides/test/collect-test-data/).
