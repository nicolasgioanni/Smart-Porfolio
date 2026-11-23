import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseImpactPlan } from './impact.mjs';
import { parseBrowserReport } from '../ci/browserDiscovery.mjs';
import { allowedBrowserSkips, validateSkipRegistry } from '../ci/browserSkips.mjs';
import { parseTestIdentity, verifyDiscoveryCoverage } from '../ci/receipts.mjs';
import { validateGeneratedSource, compileReleaseOutput } from '../release/lifecycle.mjs';
import { effectivePublicBuildEnvironment } from '../release/publicBuildInputs.mjs';

const root = process.cwd(), workspace = path.join(root, '.circleci-workspace');
const generated = 'src/content/generated/portfolio.generated.json';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, stdio: 'inherit', timeout: 30 * 60_000, ...options });
const cleanEnv = (environment = process.env) => ({ ...Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'CI', 'CIRCLE_SHA1', 'NVM_DIR'].filter((name) => environment[name] !== undefined).map((name) => [name, environment[name]])), PORTFOLIO_WORKBOOK_URL: '', PORTFOLIO_REQUIRE_REMOTE_CONTENT: 'false', NEXT_TELEMETRY_DISABLED: '1' });
export const templateBuildEnvironment = (environment = {}) => ({ ...cleanEnv(environment), ...effectivePublicBuildEnvironment('local', {}) });
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 30_000 }).trim();
const browserArgs = (validator, plan) => {
  const specs = plan.chromiumSpecs.includes('*') ? [] : plan.chromiumSpecs;
  if (validator === 'chromium-1' || validator === 'chromium-2') return { selection: 'functional', args: [...specs, '--project=chromium', `--shard=${validator.at(-1)}/2`] };
  if (validator === 'chromium-all') return { selection: 'full', args: ['--project=chromium'] };
  if (validator === 'functional-all') return { selection: 'functional', args: [...specs, '--project=chromium'] };
  if (validator === 'visual') return { selection: 'visual', args: ['--project=chromium'] };
  if (validator === 'cross-browser') return { selection: 'full', args: ['--project=firefox-critical', '--project=webkit-critical', '--project=webkit-mobile'] };
  throw new Error('Unknown browser validator.');
};
const isBrowser = (name) => ['chromium-1', 'chromium-2', 'visual', 'cross-browser'].includes(name);
function browserCommand(validator, plan, mode, output) {
  const { selection, args } = browserArgs(validator, plan);
  run(process.execPath, ['node_modules/playwright/cli.js', 'test', '--config=playwright.ci.config.ts', ...args,
    ...(mode === 'discovery' ? ['--list'] : []), `--reporter=line,${mode === 'execution' ? 'junit,' : ''}${path.join(root, 'scripts/ci/browserReporter.mjs')}`],
  { env: { ...cleanEnv(), CI_BROWSER_SELECTION: selection, CI_BROWSER_ROOT: root, CI_BROWSER_REPORT: output, CI_BROWSER_REPORT_MODE: mode, PLAYWRIGHT_JUNIT_OUTPUT_NAME: path.join(root, 'test-results/circleci-junit/playwright.xml') } });
}
export function verifyBrowser(assignment, report) {
  const parsed = parseBrowserReport(report, 'execution');
  const expected = new Set(assignment);
  if (expected.size === 0 || expected.size !== assignment.length || parsed.identities.length !== expected.size || parsed.cases.length !== expected.size) throw new Error('Browser assignment is incomplete.');
  const seen = new Set();
  for (const item of parsed.cases) {
    if (!expected.has(item.identity) || seen.has(item.identity)) throw new Error('Unexpected or duplicate browser test.');
    seen.add(item.identity);
    if (!Array.isArray(item.attempts) || item.attempts.length < 1 || item.attempts.length > 2 || item.attempts.some((a, i) => a.retry !== i || !Number.isFinite(a.durationMs) || a.durationMs < 0)) throw new Error('Invalid browser retry evidence.');
    const terminal = item.attempts.at(-1).status;
    if (terminal === 'skipped') {
      if (item.attempts.length !== 1 || !allowedBrowserSkips[item.identity]?.includes(item.skipReason)) throw new Error('Unregistered browser skip.');
    } else if (terminal !== 'passed' || item.skipReason !== null || item.attempts.slice(0, -1).some((a) => !['passed', 'failed', 'timedOut', 'skipped'].includes(a.status))) throw new Error('Browser test did not pass.');
  }
  if (parsed.identities.some((id) => !seen.has(id))) throw new Error('Browser identities differ from execution.');
}
export function verifyInputEnvelope({ envelope, planBytes, snapshot, assignmentBytes, pipelinePlan, currentHead, candidateSha }) {
  const expectedKeys = ['assignmentDigest', 'headSha', 'planDigest', 'snapshotDigest'];
  if (!envelope || Object.keys(envelope).sort().join(',') !== expectedKeys.join(',')) throw new Error('Invalid input manifest.');
  const plan = parseImpactPlan(JSON.parse(planBytes));
  const expectedPlan = parseImpactPlan(pipelinePlan);
  if (JSON.stringify(plan) !== JSON.stringify(expectedPlan) || currentHead !== candidateSha || currentHead !== envelope.headSha ||
      plan.headSha !== envelope.headSha || hash(planBytes) !== envelope.planDigest || hash(snapshot) !== envelope.snapshotDigest || hash(assignmentBytes) !== envelope.assignmentDigest) throw new Error('Candidate, plan, or content snapshot mismatch.');
  validateGeneratedSource(JSON.parse(snapshot), 'local');
  return plan;
}
export function verifyReceiptSet(validators, filenames) {
  const expected = validators.map((name) => `${name}.json`).sort();
  if (JSON.stringify([...filenames].sort()) !== JSON.stringify(expected)) throw new Error('Receipt set is missing or contains unexpected entries.');
}
async function inputs() {
  const envelope = await json(path.join(workspace, 'input/manifest.json'));
  const planBytes = await readFile(path.join(workspace, 'input/plan.json'));
  const snapshot = await readFile(path.join(workspace, 'input/content.json'));
  const assignmentBytes = await readFile(path.join(workspace, 'input/assignments.json'));
  const pipelinePlan = JSON.parse(Buffer.from(process.env.CIRCLECI_PLAN ?? '', 'base64').toString('utf8'));
  const plan = verifyInputEnvelope({ envelope, planBytes, snapshot, assignmentBytes, pipelinePlan, currentHead: head(), candidateSha: process.env.CIRCLE_SHA1 });
  await copyFile(path.join(workspace, 'input/content.json'), generated);
  return { plan, envelope };
}
async function prepare() {
  const plan = parseImpactPlan(JSON.parse(Buffer.from(process.env.CIRCLECI_PLAN ?? '', 'base64').toString('utf8')));
  if (head() !== process.env.CIRCLE_SHA1 || plan.headSha !== head()) throw new Error('Plan revision mismatch.');
  await mkdir(path.join(workspace, 'input'), { recursive: true });
  run('npm', ['run', 'generate:content'], { env: cleanEnv() });
  const content = await readFile(generated);
  validateGeneratedSource(JSON.parse(content), 'local');
  const planBytes = Buffer.from(JSON.stringify(plan));
  await writeFile(path.join(workspace, 'input/plan.json'), planBytes);
  await writeFile(path.join(workspace, 'input/content.json'), content);
  const assignments = {};
  for (const validator of plan.validators.filter(isBrowser)) {
    const output = path.join(workspace, `input/${validator}.json`);
    browserCommand(validator, plan, 'discovery', output);
    assignments[validator] = parseBrowserReport(await json(output), 'discovery').identities.sort();
  }
  if (plan.validators.includes('chromium-1') && plan.validators.includes('chromium-2')) {
    const output = path.join(workspace, 'input/functional-all.json');
    browserCommand('functional-all', plan, 'discovery', output);
    const all = parseBrowserReport(await json(output), 'discovery').identities;
    verifyDiscoveryCoverage(all, [assignments['chromium-1'], assignments['chromium-2']]);
    if (plan.tier === 'full') {
      const fullOutput = path.join(workspace, 'input/chromium-all.json');
      browserCommand('chromium-all', plan, 'discovery', fullOutput);
      const full = parseBrowserReport(await json(fullOutput), 'discovery').identities;
      verifyDiscoveryCoverage(full, [assignments['chromium-1'], assignments['chromium-2'], assignments.visual]);
      validateSkipRegistry(full);
    }
  }
  if (assignments['cross-browser']) {
    const projects = [...new Set(assignments['cross-browser'].map((id) => parseTestIdentity(id)[0]))].sort();
    if (projects.join(',') !== 'firefox-critical,webkit-critical,webkit-mobile') throw new Error('Cross-browser discovery omitted a required project.');
  }
  const assignmentBytes = Buffer.from(JSON.stringify(assignments));
  await writeFile(path.join(workspace, 'input/assignments.json'), assignmentBytes);
  await writeFile(path.join(workspace, 'input/manifest.json'), JSON.stringify({ headSha: head(), planDigest: hash(planBytes), snapshotDigest: hash(content), assignmentDigest: hash(assignmentBytes) }));
}
async function validate() {
  const { plan, envelope } = await inputs();
  const validator = process.env.VALIDATOR;
  if (!plan.validators.includes(validator)) throw new Error('Validator was not selected.');
  const npm = (...args) => run('npm', ['run', ...args], { env: cleanEnv() });
  if (validator === 'quality') { npm('docs:check'); npm('lint'); npm('typecheck'); }
  else if (validator === 'unit') npm('test', '--', '--reporter=default', '--reporter=junit', '--outputFile.junit=test-results/circleci-junit/vitest.xml');
  else if (isBrowser(validator)) {
    const assignmentsBytes = await readFile(path.join(workspace, 'input/assignments.json'));
    if (hash(assignmentsBytes) !== envelope.assignmentDigest) throw new Error('Browser assignments mismatch.');
    const browser = validator === 'cross-browser' ? ['chromium', 'firefox', 'webkit'] : ['chromium'];
    run('npx', ['--no-install', 'playwright', 'install', '--with-deps', ...browser], { env: cleanEnv() });
    const output = path.join(workspace, `${validator}-execution.json`);
    browserCommand(validator, plan, 'execution', output);
    verifyBrowser(JSON.parse(assignmentsBytes)[validator], await json(output));
  } else if (validator === 'build-export') {
    run('npm', ['run', 'build:generated'], { env: templateBuildEnvironment(process.env) });
    npm('test:quality:payload');
    await compileReleaseOutput({ sourceCommit: head() });
    run('npx', ['--no-install', 'playwright', 'install', '--with-deps', 'chromium'], { env: cleanEnv() });
    run('npm', ['run', 'test:e2e:release-static', '--', '--reporter=line,junit', '--output=test-results/playwright'], { env: { ...cleanEnv(), PLAYWRIGHT_JUNIT_OUTPUT_NAME: path.join(root, 'test-results/circleci-junit/static-export.xml') } });
  } else if (validator === 'security' || validator === 'infrastructure') {
    const toolRoot = path.join('/tmp', 'portfolio-circleci-tools');
    await mkdir(toolRoot, { recursive: true });
    const install = (tool) => run(process.execPath, ['scripts/security/installPinnedTool.mjs', tool, toolRoot], { stdio: 'ignore', env: cleanEnv() });
    if (validator === 'security') {
      for (const tool of ['actionlint', 'gitleaks', 'zizmor']) install(tool);
      try { run(path.join(toolRoot, 'actionlint/actionlint'), ['-shellcheck', '', '-pyflakes', ''], { stdio: 'ignore' }); }
      catch { throw new Error('GitHub Actions syntax validation failed.'); }
      run(process.execPath, ['scripts/security/securityScans.mjs', '--gitleaks', path.join(toolRoot, 'gitleaks/gitleaks'), '--gitleaks-mode', 'git', '--target', '.', '--zizmor', path.join(toolRoot, 'zizmor/zizmor')], { env: cleanEnv() });
      if (plan.tier === 'full') npm('audit:check');
    } else {
      for (const tool of ['terraform', 'opa']) install(tool);
      run(process.execPath, ['scripts/ci/infrastructure.mjs', path.join(toolRoot, 'terraform/terraform'), path.join(toolRoot, 'opa/opa')], { env: cleanEnv() });
    }
  } else throw new Error('Unknown validator.');
  await mkdir(path.join(workspace, 'receipts'), { recursive: true });
  await writeFile(path.join(workspace, `receipts/${validator}.json`), JSON.stringify({ validator, ...envelope, outcome: 'success' }), { flag: 'wx' });
}
async function accept() {
  const { plan, envelope } = await inputs();
  verifyReceiptSet(plan.validators, await readdir(path.join(workspace, 'receipts')));
  for (const validator of plan.validators) {
    const receipt = await json(path.join(workspace, `receipts/${validator}.json`));
    if (Object.keys(receipt).sort().join(',') !== [...Object.keys(envelope), 'validator', 'outcome'].sort().join(',') || receipt.validator !== validator || receipt.outcome !== 'success' || Object.entries(envelope).some(([k, v]) => receipt[k] !== v)) throw new Error('Missing or stale validation receipt.');
  }
  await writeFile(path.join(workspace, 'summary.json'), JSON.stringify({ headSha: plan.headSha, tier: plan.tier, selected: plan.validators, unselected: ['quality','unit','chromium-1','chromium-2','visual','cross-browser','build-export','security','infrastructure'].filter((v) => !plan.validators.includes(v)), reasons: plan.reasons }, null, 2));
  console.log(`Accepted ${plan.tier} validation for ${plan.headSha}.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commands = { prepare, validate, accept };
  Promise.resolve().then(() => { if (!commands[process.argv[2]]) throw new Error('Unknown CircleCI command.'); return commands[process.argv[2]](); }).then(async () => {
    if (process.argv[2] === 'validate') {
      await mkdir('test-results/circleci-junit', { recursive: true });
      await writeFile('test-results/circleci-junit/validation.xml', `<testsuite name="CircleCI validation" tests="1" failures="0"><testcase name="${process.env.VALIDATOR}"/></testsuite>\n`);
    }
  }).catch(async (error) => {
    console.error(error.message);
    if (process.argv[2] === 'validate' && /^[a-z0-9-]+$/.test(process.env.VALIDATOR ?? '')) {
      await mkdir('test-results/circleci-junit', { recursive: true });
      await writeFile('test-results/circleci-junit/validation.xml', `<testsuite name="CircleCI validation" tests="1" failures="1"><testcase name="${process.env.VALIDATOR}"><failure message="Validation failed; consult the job log."/></testcase></testsuite>\n`);
    }
    process.exitCode = 1;
  });
}
