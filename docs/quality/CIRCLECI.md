# CircleCI validation

GitHub’s required `verify` check uses CircleCI for quality, unit and browser testing on eligible pull requests. GitHub still scans source and dependencies, builds the sealed candidate and checks its export on those PRs. A push to a permanent branch runs the full GitHub release pipeline with the accepted workbook and exact production or preview artifact. [CI contracts](CI_CONTRACTS.md) · [Deployment](../operations/DEPLOYMENT.md)

## Pipeline and selection

`.circleci/config.yml` starts `portfolio-setup`. Setup uses the pinned Node runtime to check the checkout and classify the complete Git diff before installing project dependencies. A verified PR that needs full native coverage ends after setup. The same handoff applies to GitHub App pushes to `main` or `develop`. GitHub runs the full suite and owns acceptance. CircleCI emits no acceptance evidence on this path.

Documentation and allowlisted feature PRs continue to their selected CircleCI jobs. An explicit full CircleCI run, a tag, or a trigger whose owner cannot be established takes the conservative full CircleCI path.

Narrow selection requires a GitHub App push or pull-request event with a same-repository PR URL. A bounded, credential-free GitHub API read must confirm that the PR is open, targets `main` or `develop`, and still has this exact head revision and branch. The comparison uses the PR's actual base SHA. Unavailable metadata, a moved head, forks, or missing local base history select full coverage.

`scripts/circleci/impact.mjs` owns the versioned impact policy. The plan records the base/head revisions, changed paths, trigger, selection reasons, and selected specifications. Consumers recompute the policy before accepting a plan. A rename must include both paths; a deletion includes its old path. Remote workbook updates cannot be classified from Git paths and remain on the existing strict release pipeline.

| Change on a verified PR | Test selection |
| --- | --- |
| Ordinary Markdown documentation | Quality and source-security checks |
| Allowlisted feature implementation or styling | Quality, all unit tests, affected Chromium specifications, build/export, and source-security checks; UI coverage retains skeleton alignment, transitions, and visual comparison |
| Shared UI, global styles, routing, content generation/parsing, dependencies, CI, security or unknown paths | Full GitHub suite, CircleCI setup only |
| Security, operations or CI-contract documentation | Full GitHub suite, CircleCI setup only |

The targeted browser selection includes shared navigation, accessibility, and progressive-enhancement checks. Changes to Projects or Research also select the cross-browser job, including their mobile WebKit tests. Full validation retains two functional Chromium shards, the 25 existing Linux visual baselines, Firefox critical, WebKit critical, and mobile WebKit Research/Projects coverage. No baseline bytes, screenshot thresholds, or skeleton specifications change.

Weekly Dependabot patch groups combine candidate revisions before CI. Dependency, workflow and provider updates select full native validation. GitHub checks the applicable pins during preparation before starting the build and browsers. CircleCI finishes after planning on these verified full-tier PRs. A new commit or an updated merge base can require fresh validation.

`prepare` generates one local-template snapshot and discovers browser assignments. Jobs restore that snapshot and verify the source revision and input hashes. Each selected validator must produce a matching successful receipt. `acceptance` rejects missing, extra, stale, or unsuccessful evidence and records the selected and intentionally unselected checks. An unselected check is not represented as an executed passing test.

CircleCI runs existing source scanners and full-plan dependency audits, plus credential-free infrastructure checks for full plans. GitHub CodeQL, dependency review, native producer receipts, release attestations, and deployment admission remain in GitHub Actions. GitHub also audits the locked dependencies on every candidate.

## Runtime and reports

Jobs use the pinned Ubuntu 24.04 machine image and Node version declared in the CircleCI configuration. Only continued validation jobs install project dependencies. Dependencies come from `package-lock.json`; npm downloads are cached by its checksum. Existing installed Playwright versions determine the browser binaries. Linux screenshots must compare against the existing reviewed baselines with zero difference.

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

## How the required GitHub check uses CircleCI

1. GitHub prepares the template snapshot for the PR merge candidate. It selects CircleCI only for a same-repository PR with an allowlisted diff, matching head and merge trees, and generated bytes identical to the committed snapshot. A changed workflow, dependency, test, content input or unknown path selects the full native suite. This also lets a change to the verifier itself bootstrap through native CI.
2. For an eligible PR, GitHub skips its duplicate quality, unit, functional browser, visual and cross-browser jobs. CircleCI runs the validators in the impact table. GitHub still requires the native source-security, infrastructure, dependency-review, sealed-build and export receipts.
3. The required `verify` job checks the current GitHub PR identity and recomputes its expected plan from Git. It reads CircleCI’s public API directly and binds the latest branch pipeline to the repository, SHA, exact setup and continuation configurations, successful jobs and their dependencies. The CircleCI acceptance job checks the selected receipts. Both providers must attest to the same committed template bytes.
4. Before accepting, the verifier rechecks the provider run and GitHub PR for supersession. A terminal failure, ambiguous rerun, stale candidate, missing evidence or timeout blocks the merge. Inspect **CI → verify** and the corresponding CircleCI workflow. After a failed or ambiguous run, fix the cause and trigger a fresh pipeline for the current revision before rerunning GitHub verification.

The required path needs no CircleCI credential and does not wait for a GitHub commit-status webhook. The optional **CircleCI completion evidence** manual workflow accepts a workflow UUID and commit SHA for diagnostics. It runs trusted default-branch code and can use a configured `CIRCLECI_API_TOKEN` if authenticated reads are necessary.

A GitHub account restriction can still prevent the required GitHub check or deployment from starting. Check the run annotation to distinguish that condition from an executed test failure. Standard GitHub-hosted runner minutes are free in public repositories. [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)

## Local checks and maintenance

Run `npm run test:circleci` for the impact, runner, configuration, and API-verifier contracts. These tests use injected provider boundaries and do not establish hosted execution. Run documentation validation, lint, types, the relevant browser/static-export checks, and the existing broader validation before publication.

Use the official CircleCI CLI to run `circleci config validate .circleci/config.yml`, and validate a generated full continuation configuration as well. Keep the selector, emitted jobs, receipt acceptance, API-verifier job allowlist, tests, and this guide synchronized. The owning [validation specialist](../../.agents/skills/portfolio-validation/SKILL.md) and [skeleton specialist](../../.agents/skills/portfolio-skeleton-regression/SKILL.md) still apply.

Provider references: [dynamic configuration](https://circleci.com/docs/guides/orchestrate/using-dynamic-configuration/), [API v2](https://circleci.com/docs/api/v2/), [status updates](https://circleci.com/docs/guides/integration/status-updates/), and [test reporting](https://circleci.com/docs/guides/test/collect-test-data/).
