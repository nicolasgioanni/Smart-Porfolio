import { execFileSync } from 'node:child_process';
import { createImpactPlan } from './impact.mjs';
import { stringify } from 'yaml';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', timeout: 30_000 });
const installNode = `nvm install 22.23.3 && nvm use 22.23.3 && test "$(node -v)" = v22.23.3 && printf 'export PATH="%s:$PATH"\\n' "$(dirname "$(command -v node)")" >> "$BASH_ENV" && npm ci`;
export function continuationConfig(validators, plan = null) {
  const encodedPlan = Buffer.from(JSON.stringify(plan)).toString('base64');
  const jobs = validators.map((validator) => ({ validate: { name: validator, validator, requires: ['prepare'] } }));
  return stringify({ version: 2.1, jobs: {
    prepare: { machine: { image: 'ubuntu-2404:2026.11.1' }, environment: { CIRCLECI_PLAN: encodedPlan }, steps: [
      'checkout', { restore_cache: { keys: ['portfolio-npm-v1-{{ checksum "package-lock.json" }}'] } }, { run: { name: 'Install dependencies', command: installNode } },
      { save_cache: { key: 'portfolio-npm-v1-{{ checksum "package-lock.json" }}', paths: ['~/.npm'] } },
      { run: { name: 'Prepare template snapshot and assignments', command: 'node scripts/circleci/run.mjs prepare' } },
      { persist_to_workspace: { root: '.', paths: ['.circleci-workspace/input'] } }
    ] },
    validate: { parameters: { validator: { type: 'string' } }, machine: { image: 'ubuntu-2404:2026.11.1' },
      environment: { VALIDATOR: '<< parameters.validator >>', CIRCLECI_PLAN: encodedPlan }, steps: ['checkout',
        { restore_cache: { keys: ['portfolio-npm-v1-{{ checksum "package-lock.json" }}'] } },
        { run: { name: 'Install dependencies', command: installNode } },
        { attach_workspace: { at: '.' } },
        { run: { name: 'Run selected validator', command: 'node scripts/circleci/run.mjs validate' } },
        { persist_to_workspace: { root: '.', paths: ['.circleci-workspace/receipts/<< parameters.validator >>.json'] } },
        { store_test_results: { path: 'test-results/circleci-junit' } },
        { store_artifacts: { path: 'test-results/playwright', destination: 'playwright-failures' } }
      ] },
    acceptance: { machine: { image: 'ubuntu-2404:2026.11.1' }, environment: { CIRCLECI_PLAN: encodedPlan }, steps: ['checkout',
      { run: installNode }, { attach_workspace: { at: '.' } },
      { run: { name: 'Verify selected validation receipts', command: 'node scripts/circleci/run.mjs accept' } },
      { store_artifacts: { path: '.circleci-workspace/summary.json', destination: 'validation-summary.json' } }
    ] }
  }, workflows: { 'portfolio-validation': { jobs: ['prepare', ...jobs, { acceptance: { requires: validators } }] } } });
}
export async function continuePipeline(key, configuration, fetcher = fetch) {
  if (typeof key !== 'string' || !key.trim()) throw new Error('CircleCI continuation key is missing.');
  let response;
  try {
    response = await fetcher('https://circleci.com/api/v2/pipeline/continue', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 'continuation-key': key, configuration })
    });
  } catch {
    throw new Error('CircleCI continuation request failed.');
  }
  // No response body or transport error is logged: it may contain sensitive input.
  if (!response.ok) throw new Error(`CircleCI continuation failed (HTTP ${Number.isInteger(response.status) ? response.status : 'unknown'}).`);
}
// Narrow only with a current, same-repository pull request and its actual base.
// The public GitHub response is credential-free; any uncertainty selects full.
export async function resolveImpactInputs(env, headSha, { runGit = git, fetcher = fetch } = {}) {
  const fallback = { baseSha: headSha, changedPaths: [], trigger: 'unknown' };
  if (env.CIRCLE_TAG || ['main', 'develop'].includes(env.CIRCLE_BRANCH) || env.PIPELINE_TRIGGER !== 'github_app' || !['push', 'pull_request'].includes(env.PIPELINE_EVENT) ||
      typeof env.CIRCLE_BRANCH !== 'string' || !env.CIRCLE_BRANCH) return fallback;
  const match = /^https:\/\/github\.com\/nicolasgioanni\/Smart-Porfolio\/pull\/([1-9][0-9]*)$/.exec(env.CIRCLE_PULL_REQUEST ?? '');
  if (!match) return fallback;
  try {
    const response = await fetcher(`https://api.github.com/repos/nicolasgioanni/Smart-Porfolio/pulls/${match[1]}`, {
      redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { accept: 'application/vnd.github+json' }
    });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 65_536) return fallback;
    if (!response.body) return fallback;
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) { await reader.cancel(); return fallback; }
      chunks.push(value);
    }
    const pr = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (pr.state !== 'open' || pr.number !== Number(match[1]) || pr.base?.repo?.full_name !== 'nicolasgioanni/Smart-Porfolio' ||
        !['main', 'develop'].includes(pr.base?.ref) || !/^[a-f0-9]{40}$/.test(pr.base?.sha ?? '') ||
        pr.head?.repo?.full_name !== 'nicolasgioanni/Smart-Porfolio' || pr.head?.sha !== headSha || pr.head?.ref !== env.CIRCLE_BRANCH) return fallback;
    const baseSha = runGit('merge-base', headSha, pr.base.sha).trim();
    if (!/^[a-f0-9]{40}$/.test(baseSha)) return fallback;
    const changedPaths = runGit('diff', '--no-renames', '--name-only', '-z', baseSha, headSha).split('\0').filter(Boolean);
    return { baseSha, changedPaths, trigger: 'pull_request' };
  } catch { return fallback; }
}
export async function main(env = process.env) {
  const headSha = git('rev-parse', 'HEAD').trim();
  if (headSha !== env.CIRCLE_SHA1) throw new Error('Checkout does not match pipeline revision.');
  const { baseSha, changedPaths, trigger } = await resolveImpactInputs(env, headSha);
  const plan = createImpactPlan({ changedPaths, baseSha, headSha, forceFull: env.FORCE_FULL === 'true', trigger });
  const configuration = continuationConfig(plan.validators, plan);
  await continuePipeline(env.CIRCLE_CONTINUATION_KEY, configuration);
  console.log(`Selected ${plan.tier} validation: ${plan.validators.join(', ')}.`);
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
