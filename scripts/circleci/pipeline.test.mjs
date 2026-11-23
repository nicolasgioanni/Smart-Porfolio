// @vitest-environment node

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { continuationConfig } from './setup.mjs';
import { verifyBrowser } from './run.mjs';
import { testIdentity } from '../ci/receipts.mjs';

const id = testIdentity({ project: 'chromium', file: 'tests/e2e/example.spec.ts', titlePath: ['works'] });
const report = (cases) => ({ schemaVersion: 1, mode: 'execution', status: 'passed', errorCount: 0, identities: [id], cases, durationMs: 1 });
const item = (status = 'passed') => ({ identity: id, attempts: [{ status, durationMs: 1, retry: 0 }], skipReason: status === 'skipped' ? 'unreviewed' : null });

test('continuation names only selected jobs and requires all of them', () => {
  const config = parse(continuationConfig(['quality', 'security']));
  const jobs = config.workflows['portfolio-validation'].jobs;
  assert.deepEqual(jobs.at(-1).acceptance.requires, ['quality', 'security']);
  assert.deepEqual(jobs.slice(1, -1).map((entry) => entry.validate.validator), ['quality', 'security']);
  assert.equal(config.jobs.prepare.machine.image, 'ubuntu-2404:2026.11.1');
});

test('browser evidence requires each assigned test to finish or have a registered skip', () => {
  verifyBrowser([id], report([item()]));
  assert.throws(() => verifyBrowser([id], report([])));
  assert.throws(() => verifyBrowser([id], report([item('skipped')])));
  assert.throws(() => verifyBrowser([id], report([item('failed')])));
  assert.throws(() => verifyBrowser([id, id], report([item()])));
});

test('continuation rejects missing keys and redacts transport failures', async () => {
  const { continuePipeline } = await import('./setup.mjs');
  await assert.rejects(continuePipeline('', ''), /key is missing/);
  await assert.rejects(continuePipeline('secret-key', '', async (_url, options) => {
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    throw new Error('secret-key transport details');
  }), (error) => error.message === 'CircleCI continuation request failed.');
  await assert.rejects(continuePipeline('secret-key', '', async () => ({ ok: false, status: 403 })), /HTTP 403/);
});

test('manifest rejects changed inputs and receipt set rejects missing or extra jobs', async () => {
  const { createHash } = await import('node:crypto');
  const { createImpactPlan } = await import('./impact.mjs');
  const { verifyInputEnvelope, verifyReceiptSet } = await import('./run.mjs');
  const sha = 'a'.repeat(40);
  const plan = createImpactPlan({ headSha: sha, baseSha: sha, changedPaths: ['docs/README.md'] });
  const planBytes = Buffer.from(JSON.stringify(plan));
  const snapshot = Buffer.from(JSON.stringify({ metadata: { sourceMode: 'templates', sources: { profile: 'template' } } }));
  const assignmentBytes = Buffer.from('{}');
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const envelope = { headSha: sha, planDigest: digest(planBytes), snapshotDigest: digest(snapshot), assignmentDigest: digest(assignmentBytes) };
  const inputs = { envelope, planBytes, snapshot, assignmentBytes, pipelinePlan: plan, currentHead: sha, candidateSha: sha };
  assert.deepEqual(verifyInputEnvelope(inputs), plan);
  assert.throws(() => verifyInputEnvelope({ ...inputs, snapshot: Buffer.from('{}') }));
  assert.throws(() => verifyInputEnvelope({ ...inputs, currentHead: 'b'.repeat(40) }));
  assert.throws(() => verifyInputEnvelope({ ...inputs, envelope: { ...envelope, extra: true } }));
  assert.throws(() => verifyInputEnvelope({ ...inputs, pipelinePlan: { ...plan, validators: [] } }));
  verifyReceiptSet(['quality', 'security'], ['security.json', 'quality.json']);
  assert.throws(() => verifyReceiptSet(['quality', 'security'], ['quality.json']));
  assert.throws(() => verifyReceiptSet(['quality'], ['quality.json', 'unit.json']));
});

test('targeted impact requires a current same-repository PR and its actual base', async () => {
  const { resolveImpactInputs } = await import('./setup.mjs');
  const sha = 'a'.repeat(40), base = 'b'.repeat(40), ancestor = 'c'.repeat(40);
  const env = { PIPELINE_TRIGGER: 'github_app', PIPELINE_EVENT: 'push', CIRCLE_BRANCH: 'feature', CIRCLE_PULL_REQUEST: 'https://github.com/nicolasgioanni/Smart-Porfolio/pull/12' };
  const pr = { number: 12, state: 'open', base: { sha: base, ref: 'develop', repo: { full_name: 'nicolasgioanni/Smart-Porfolio' } }, head: { sha, ref: 'feature', repo: { full_name: 'nicolasgioanni/Smart-Porfolio' } } };
  const response = (body) => async (_url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.authorization, undefined);
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const calls = [];
  const runGit = (...args) => {
    calls.push(args);
    return args[0] === 'merge-base' ? `${ancestor}\n` : 'src/features/projects/old.tsx\0src/features/projects/new.tsx\0src/features/projects/deleted.tsx\0';
  };
  const result = await resolveImpactInputs(env, sha, { runGit, fetcher: response(pr) });
  assert.equal(result.trigger, 'pull_request');
  assert.equal(result.baseSha, ancestor);
  assert.deepEqual(calls[0], ['merge-base', sha, base]);
  assert.deepEqual(calls[1], ['diff', '--no-renames', '--name-only', '-z', ancestor, sha]);
  assert.deepEqual(result.changedPaths, ['src/features/projects/old.tsx', 'src/features/projects/new.tsx', 'src/features/projects/deleted.tsx']);
  for (const invalid of [
    { ...env, PIPELINE_EVENT: 'schedule' }, { ...env, PIPELINE_EVENT: 'api' }, { ...env, PIPELINE_TRIGGER: 'api' },
    { ...env, CIRCLE_BRANCH: 'develop' }, { ...env, CIRCLE_BRANCH: 'main' },
    { ...env, CIRCLE_PULL_REQUEST: 'https://github.com/other/Smart-Porfolio/pull/12' },
    { ...env, CIRCLE_PULL_REQUEST: 'https://github.com/nicolasgioanni/Smart-Porfolio/pull/012' }
  ]) assert.equal((await resolveImpactInputs(invalid, sha, { runGit, fetcher: response(pr) })).trigger, 'unknown');
  assert.equal((await resolveImpactInputs(env, sha, { runGit, fetcher: response({ ...pr, head: { ...pr.head, sha: 'd'.repeat(40) } }) })).trigger, 'unknown');
  assert.equal((await resolveImpactInputs(env, sha, { runGit, fetcher: response({ ...pr, head: { ...pr.head, repo: { full_name: 'other/fork' } } }) })).trigger, 'unknown');
  assert.equal((await resolveImpactInputs({ ...env, PIPELINE_EVENT: 'pull_request' }, sha, { runGit, fetcher: response(pr) })).trigger, 'pull_request');
  assert.equal((await resolveImpactInputs(env, sha, { runGit, fetcher: async () => { throw new Error('network'); } })).trigger, 'unknown');
});

test('template build always uses local public fixture and excludes host provider settings', async () => {
  const { templateBuildEnvironment } = await import('./run.mjs');
  const absent = templateBuildEnvironment();
  assert.equal(absent.NEXT_PUBLIC_TURNSTILE_SITE_KEY, 'local-release-test-turnstile-site-key');
  const hostile = templateBuildEnvironment({ PATH: '/bin', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'hostile-public', NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY: 'hostile-preview', TURNSTILE_SECRET_KEY: 'secret', PORTFOLIO_WORKBOOK_URL: 'https://private.invalid' });
  assert.equal(hostile.PATH, '/bin');
  assert.equal(hostile.NEXT_PUBLIC_TURNSTILE_SITE_KEY, absent.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  assert.equal(hostile.PORTFOLIO_WORKBOOK_URL, '');
  assert.equal(hostile.NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY, undefined);
  assert.equal(hostile.TURNSTILE_SECRET_KEY, undefined);
});

test('security scanner receives a private temp root without GitHub Actions environment', async () => {
  const { securityScannerArguments } = await import('./run.mjs');
  const { parseSecurityScansCli } = await import('../security/securityScans.mjs');
  const args = securityScannerArguments('/tmp/portfolio-tools', '/tmp/portfolio-private-scans');
  const parsed = parseSecurityScansCli(args.slice(1), {});
  assert.equal(parsed.tempRoot, '/tmp/portfolio-private-scans');
  assert.equal(parsed.gitleaksMode, 'git');
  assert.equal(parsed.zizmor, '/tmp/portfolio-tools/zizmor/zizmor');
});
