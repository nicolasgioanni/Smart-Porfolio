// @vitest-environment node
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assessPullRequest, parseRawChanges, selectPullRequestLane, readPullRequestEvidence } from './prGate.mjs';

async function fixture(changedFile = "docs/example.md") {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'portfolio-pr-gate-'));
  const run = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' } }).trim();
  run('init');
  await mkdir(path.join(dir, 'src/content/generated'), { recursive: true });
  await writeFile(path.join(dir, 'src/content/generated/portfolio.generated.json'), '{}\n');
  run('add', '.'); run('commit', '-m', 'base'); const base = run('rev-parse', 'HEAD');
  await mkdir(path.dirname(path.join(dir, changedFile)), { recursive: true });
  await writeFile(path.join(dir, changedFile), 'change\n');
  run('add', '.'); run('commit', '-m', 'feature'); const head = run('rev-parse', 'HEAD');
  const tree = run('rev-parse', 'HEAD^{tree}');
  const merge = run('commit-tree', tree, '-p', base, '-p', head, '-m', 'merge');
  run('checkout', '--detach', merge);
  const repository = 'nicolasgioanni/Smart-Porfolio', number = 12, ref = `refs/pull/${number}/merge`;
  const candidate = { schemaVersion: 1, repository, event: 'pull_request', ref, workflowRef: `${repository}/.github/workflows/ci.yml@${ref}`, workflowSha: head, sourceSha: merge, eventSha: merge, runHeadSha: head, branchTip: null, pullNumber: number, baseBranch: 'main', force: false, runId: 1, runNumber: 1, producerAttempt: 1 };
  const pr = { number, state: 'open', merge_commit_sha: merge, base: { repo: { full_name: repository }, sha: base, ref: 'main' }, head: { repo: { full_name: repository }, sha: head, ref: 'feature' } };
  const event = { number, repository: { full_name: repository }, pull_request: pr };
  const eventPath = path.join(dir, 'event.json'); await writeFile(eventPath, JSON.stringify(event));
  const environment = { GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: repository, GITHUB_SHA: merge, GITHUB_EVENT_PATH: eventPath, GH_TOKEN: 'github-only' };
  return { dir, run, candidate, event, pr, environment, projectRoot: dir, snapshotBytes: Buffer.from('{}\n') };
}

test('real Git merge and tree identity admits narrow PR only with exact generated snapshot', async () => {
  const f = await fixture();
  try {
    expect(assessPullRequest(f).plan.tier).toBe('docs');
    expect(await selectPullRequestLane(f)).toBe('circleci');
    expect(assessPullRequest({ ...f, event: { ...f.event, pull_request: { ...f.pr, merge_commit_sha: null } } }).plan.tier).toBe('docs');
    expect(await selectPullRequestLane({ ...f, snapshotBytes: Buffer.from('other') })).toBe('native');
    expect(() => assessPullRequest({ ...f, event: { ...f.event, pull_request: { ...f.pr, head: { ...f.pr.head, repo: { full_name: 'other/fork' } } } } })).toThrow();
    expect(() => assessPullRequest({ ...f, event: { ...f.event, pull_request: { ...f.pr, base: { ...f.pr.base, sha: f.candidate.runHeadSha } } } })).toThrow();
    const otherTree = f.run('rev-parse', `${f.pr.base.sha}^{tree}`);
    const badMerge = f.run('commit-tree', otherTree, '-p', f.pr.base.sha, '-p', f.candidate.runHeadSha, '-m', 'bad merge');
    f.run('checkout', '--detach', badMerge);
    const candidate = { ...f.candidate, sourceSha: badMerge, eventSha: badMerge };
    const event = { ...f.event, pull_request: { ...f.pr, merge_commit_sha: badMerge } };
    expect(() => assessPullRequest({ ...f, candidate, event, environment: { ...f.environment, GITHUB_SHA: badMerge } })).toThrow();
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('raw Git diff rejects executable, symlink and malformed paths', () => {
  const zero = '0'.repeat(40), id = 'a'.repeat(40);
  expect(parseRawChanges(Buffer.from(`:000000 100644 ${zero} ${id} A\0docs/a.md\0`))).toEqual(['docs/a.md']);
  for (const mode of ['100755', '120000', '160000']) expect(() => parseRawChanges(Buffer.from(`:000000 ${mode} ${zero} ${id} A\0docs/a.md\0`))).toThrow();
  expect(() => parseRawChanges(Buffer.from(`:000000 100644 ${zero} ${id} A\0docs/a.md`))).toThrow();
  expect(() => parseRawChanges(Buffer.from([0xff, 0x00]))).toThrow();
  expect(() => parseRawChanges(Buffer.alloc(8 * 1024 * 1024 + 1))).toThrow();
});

test('evidence rechecks live PR after external workflow and rejects movement', async () => {
  const f = await fixture();
  try {
    let calls = 0;
    const verifyWorkflow = async ({ plan }) => ({ workflowId: '00000000-0000-4000-8000-000000000001', sha: plan.headSha, jobCount: 4 });
    const readGithub = async (_endpoint, options) => { expect(options.token).toBe('github-only'); calls += 1; return f.pr; };
    const result = await readPullRequestEvidence({ ...f, readGithub, verifyWorkflow });
    expect(result).toMatchObject({ provider: 'circleci', mergeSha: f.candidate.sourceSha, headSha: f.candidate.runHeadSha, tier: 'docs', jobCount: 4 });
    expect(calls).toBe(2);
    await expect(readPullRequestEvidence({ ...f, verifyWorkflow, readGithub: async () => ({ ...f.pr, merge_commit_sha: null }) })).rejects.toThrow();
    let reads = 0;
    await expect(readPullRequestEvidence({ ...f, verifyWorkflow, readGithub: async () => (++reads === 1 ? f.pr : { ...f.pr, state: 'closed' }) })).rejects.toThrow();
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('security, CI and dependency paths use native validation', async () => {
  for (const changed of ['docs/security/SECURITY.md', 'package.json', '.github/workflows/ci.yml', 'src/features/projects/widget.test.ts']) {
    const f = await fixture(changed);
    try { expect(await selectPullRequestLane(f)).toBe('native'); }
    finally { await rm(f.dir, { recursive: true, force: true }); }
  }
});
