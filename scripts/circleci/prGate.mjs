import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { parseCandidate, repository } from '../ci/plan.mjs';
import { readGithubEvidence } from '../ci/githubEvidence.mjs';
import { generatedContentPath } from '../ci/snapshot.mjs';
import { createImpactPlan } from './impact.mjs';

const sha = /^[a-f0-9]{40}$/;
const git = (root, ...args) => execFileSync('git', args, { cwd: root, timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const text = (buffer) => new TextDecoder('utf-8', { fatal: true }).decode(buffer);
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');
const fail = () => { throw new Error('Pull request is not eligible for CircleCI delegation.'); };

function validatePullRequest(pr, candidate, baseSha, headRef, requireMerge = true) {
  if (!pr || pr.number !== candidate.pullNumber || pr.state !== 'open' || pr.base?.repo?.full_name !== repository ||
      pr.head?.repo?.full_name !== repository || pr.base?.ref !== candidate.baseBranch || pr.base?.sha !== baseSha ||
      pr.head?.sha !== candidate.runHeadSha || pr.head?.ref !== headRef || (requireMerge && pr.merge_commit_sha !== candidate.sourceSha)) fail();
}

export function parseRawChanges(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 8 * 1024 * 1024) fail();
  const parts = text(bytes).split('\0');
  if (parts.at(-1) !== '') fail();
  parts.pop();
  if (!parts.length || parts.length % 2 !== 0 || parts.length > 20_000) fail();
  const paths = [];
  for (let i = 0; i < parts.length; i += 2) {
    const match = /^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} ([AMD])$/.exec(parts[i]);
    if (!match) fail();
    const [, oldMode, newMode, status] = match;
    if ((status === 'A' && (oldMode !== '000000' || newMode !== '100644')) ||
        (status === 'D' && (oldMode !== '100644' || newMode !== '000000')) ||
        (status === 'M' && (oldMode !== '100644' || newMode !== '100644'))) fail();
    paths.push(parts[i + 1]);
  }
  return paths;
}

export function assessPullRequest({ candidate: value, environment, projectRoot, event, snapshotBytes }) {
  const candidate = parseCandidate(value);
  if (candidate.event !== 'pull_request' || environment.GITHUB_EVENT_NAME !== 'pull_request' ||
      environment.GITHUB_REPOSITORY !== repository || environment.GITHUB_SHA !== candidate.sourceSha ||
      event?.repository?.full_name !== repository || event.number !== candidate.pullNumber) fail();
  const pr = event.pull_request, baseSha = pr?.base?.sha, headRef = pr?.head?.ref;
  if (!sha.test(baseSha ?? '') || typeof headRef !== 'string' || !headRef || headRef.length > 255 || headRef === 'main' || headRef === 'develop') fail();
  validatePullRequest(pr, candidate, baseSha, headRef, false);
  git(projectRoot, 'check-ref-format', `refs/heads/${headRef}`);
  if (text(git(projectRoot, 'rev-parse', 'HEAD')).trim() !== candidate.sourceSha) fail();
  const parents = text(git(projectRoot, 'rev-list', '--parents', '-n', '1', candidate.sourceSha)).trim().split(' ');
  if (parents.length !== 3 || parents[0] !== candidate.sourceSha || parents[1] !== baseSha || parents[2] !== candidate.runHeadSha) fail();
  git(projectRoot, 'merge-base', '--is-ancestor', baseSha, candidate.runHeadSha);
  const mergeTree = text(git(projectRoot, 'rev-parse', `${candidate.sourceSha}^{tree}`)).trim();
  const headTree = text(git(projectRoot, 'rev-parse', `${candidate.runHeadSha}^{tree}`)).trim();
  if (!sha.test(mergeTree) || mergeTree !== headTree) fail();
  const changedPaths = parseRawChanges(git(projectRoot, 'diff', '--raw', '-z', '--no-abbrev', '--no-renames', '--no-ext-diff', '--no-textconv', baseSha, candidate.runHeadSha));
  const plan = createImpactPlan({ changedPaths, baseSha, headSha: candidate.runHeadSha, trigger: 'pull_request' });
  if (plan.tier === 'full') fail();
  const entry = text(git(projectRoot, 'ls-tree', '-z', candidate.runHeadSha, '--', generatedContentPath));
  const entryParts = entry.split('\t');
  if (entryParts.length !== 2 || !/^100644 blob [a-f0-9]{40}$/.test(entryParts[0]) || entryParts[1] !== `${generatedContentPath}\0`) fail();
  const committed = git(projectRoot, 'show', `${candidate.runHeadSha}:${generatedContentPath}`);
  if (snapshotBytes !== undefined && (!Buffer.isBuffer(snapshotBytes) || !committed.equals(snapshotBytes))) fail();
  return { candidate, plan, baseSha, headRef, snapshotByteDigest: digest(committed) };
}

async function inspect({ candidate, environment = process.env, projectRoot = process.cwd(), snapshotBytes }) {
  if (!environment.GITHUB_EVENT_PATH || (await stat(environment.GITHUB_EVENT_PATH)).size > 2 * 1024 * 1024) fail();
  const event = JSON.parse(await readFile(environment.GITHUB_EVENT_PATH, 'utf8'));
  return assessPullRequest({ candidate, environment, projectRoot, event, snapshotBytes });
}

export async function selectPullRequestLane(options) {
  try {
    if (!Buffer.isBuffer(options.snapshotBytes)) return 'native';
    await inspect(options);
    return 'circleci';
  } catch { return 'native'; }
}

export async function readPullRequestEvidence(options) {
  const result = await inspect(options);
  const { candidate, plan, baseSha, headRef, snapshotByteDigest } = result;
  const readEvidence = options.readGithub ?? readGithubEvidence;
  const read = () => readEvidence(`/pulls/${candidate.pullNumber}`, { token: options.environment.GH_TOKEN });
  validatePullRequest(await read(), candidate, baseSha, headRef);
  const verify = options.verifyWorkflow ?? (await import('./verify.mjs')).verifyLatestPullRequestWorkflow;
  const workflow = await verify({ plan, pullNumber: candidate.pullNumber, headRef, baseRef: candidate.baseBranch });
  validatePullRequest(await read(), candidate, baseSha, headRef);
  if (workflow.sha !== candidate.runHeadSha || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(workflow.workflowId ?? '') || workflow.jobCount !== plan.validators.length + 2) fail();
  return { provider: 'circleci', workflowId: workflow.workflowId, headSha: candidate.runHeadSha, baseSha,
    mergeSha: candidate.sourceSha, snapshotByteDigest, tier: plan.tier, validators: plan.validators, jobCount: workflow.jobCount };
}
