import { pathToFileURL } from 'node:url';

const API = 'https://circleci.com/api/v2';
const PROJECT = 'circleci/KQ3AcKmoBm6ME2ewoJjyBd/D2FVgecxDxnu3fC6LxpR1h';
const DEFINITION = 'f62f1de2-ddb7-496e-b8e9-0d8d22441757';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/i;
const JOBS = new Set(['prepare', 'quality', 'unit', 'chromium-1', 'chromium-2', 'visual', 'cross-browser', 'build-export', 'security', 'infrastructure', 'acceptance']);
const MAX_BYTES = 1_000_000;
const MAX_PAGES = 20;
const MAX_JOBS = 100;
const REQUEST_MS = 15_000;
const DEADLINE_MS = 20 * 60_000;
const POLL_MS = 10_000;
const fail = (reason) => { throw new Error(`CircleCI verification failed: ${reason}`); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function validRepository(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/nicolasgioanni\/Smart-Porfolio(?:\.git)?$/.test(url.pathname);
  } catch { return false; }
}


async function request(path, token, fetchImpl, deadline, now) {
  const remaining = deadline - now();
  if (remaining <= 0) fail('deadline exceeded');
  let response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      headers: { Accept: 'application/json', ...(token ? { 'Circle-Token': token } : {}) },
      redirect: 'error', signal: AbortSignal.timeout(Math.min(REQUEST_MS, remaining)),
    });
    if (!response.ok || response.redirected) fail('API returned an unsuccessful response');
    if (!response.body) fail('API returned an empty response');
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); fail('API response exceeded size limit'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    // Never propagate provider or transport error text, which can contain credentials.
    fail('API request failed or returned malformed data');
  }
}

export async function verifyCircleCI({ workflowId, expectedSha, token, fetchImpl = fetch, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), expected = null, captureJobs = () => {} }) {
  if (!UUID.test(workflowId ?? '') || !SHA.test(expectedSha ?? '')) fail('workflow ID or expected SHA is invalid');
  if (token !== undefined && (typeof token !== 'string' || (token !== '' && !token.trim()))) fail('CIRCLECI_API_TOKEN is invalid');
  const deadline = now() + DEADLINE_MS;
  let workflow;
  for (let polls = 0; polls < 121; polls += 1) {
    workflow = await request(`/workflow/${workflowId}`, token, fetchImpl, deadline, now);
    if (!object(workflow) || workflow.id !== workflowId || workflow.name !== 'portfolio-validation' || workflow.project_slug !== PROJECT || !UUID.test(workflow.pipeline_id ?? '')) fail('workflow identity is invalid');
    if (workflow.status === 'success') break;
    if (!['running', 'not_run', 'queued'].includes(workflow.status)) fail('workflow did not succeed');
    if (now() + POLL_MS >= deadline || polls === 120) fail('workflow completion timed out');
    await sleep(POLL_MS);
  }
  const pipeline = await request(`/pipeline/${workflow.pipeline_id}`, token, fetchImpl, deadline, now);
  if (!object(pipeline) || pipeline.id !== workflow.pipeline_id || pipeline.project_slug !== PROJECT || !Array.isArray(pipeline.errors) || pipeline.errors.length !== 0) fail('pipeline identity or errors are invalid');
  for (const field of ['pipeline_definition_id', 'definition_id']) {
    if (field in pipeline && pipeline[field] !== DEFINITION) fail('pipeline definition is invalid');
  }
  let identityPresent = false;
  if ('vcs' in pipeline) {
    identityPresent = true;
    if (!object(pipeline.vcs) || pipeline.vcs.revision !== expectedSha) fail('pipeline revision is invalid');
    const urls = ['target_repository_url', 'origin_repository_url'].filter((field) => field in pipeline.vcs).map((field) => pipeline.vcs[field]);
    if (!urls.length || urls.some((url) => !validRepository(url))) fail('pipeline repository is invalid');
  }
  const parameters = pipeline.trigger_parameters;
  if (parameters !== undefined && !object(parameters)) fail('pipeline trigger parameters are invalid');
  const hasGit = object(parameters) && 'git' in parameters;
  const hasApp = object(parameters) && 'github_app' in parameters;
  if (hasGit || hasApp) {
    if (!object(parameters.circleci) || parameters.circleci.trigger_type !== 'github_app') fail('pipeline trigger is invalid');
    if (hasGit && (!object(parameters.git) || parameters.git.checkout_sha !== expectedSha || !validRepository(parameters.git.repo_url))) fail('GitHub App checkout identity is invalid');
    if (hasApp) {
      const app = parameters.github_app;
      if (!object(app) || app.commit_sha !== expectedSha || !validRepository(app.repo_url) || app.repo_full_name !== 'nicolasgioanni/Smart-Porfolio') fail('GitHub App event identity is invalid');
      if ('pull_request_head_sha' in app && app.pull_request_head_sha !== expectedSha) fail('GitHub App revision is invalid');
    }
  }
  if (!identityPresent && !(hasGit && hasApp)) fail('pipeline checkout identity is missing');
  if (expected) {
    if (!hasGit || !hasApp || !['pull_request', 'push'].includes(parameters.circleci.event_type)) fail('pipeline PR trigger identity is invalid');
    const { git, github_app: app } = parameters;
    if (git.ref !== `refs/heads/${expected.headRef}` || git.branch !== expected.headRef || app.branch !== expected.headRef || app.ref !== expected.headRef || app.full_ref !== expected.headRef) fail('pipeline branch identity is invalid');
    const config = await request(`/pipeline/${workflow.pipeline_id}/config`, token, fetchImpl, deadline, now);
    if (!object(config) || config.setup_config !== expected.setupConfig || config.source !== expected.continuationConfig) fail('pipeline configuration differs from trusted plan');
  }
  const jobs = []; const seenPages = new Set(); let pageToken = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = pageToken === null ? '' : `?page-token=${encodeURIComponent(pageToken)}`;
    const data = await request(`/workflow/${workflowId}/job${query}`, token, fetchImpl, deadline, now);
    if (!object(data) || !Array.isArray(data.items) || !(data.next_page_token === undefined || data.next_page_token === null || (typeof data.next_page_token === 'string' && data.next_page_token.length > 0 && data.next_page_token.length <= 512))) fail('job page is malformed');
    jobs.push(...data.items);
    if (jobs.length > MAX_JOBS) fail('too many jobs');
    if (data.next_page_token == null) { pageToken = null; break; }
    if (seenPages.has(data.next_page_token)) fail('job pagination repeated');
    seenPages.add(data.next_page_token); pageToken = data.next_page_token;
  }
  if (pageToken !== null) fail('too many job pages');
  const byName = new Map();
  for (const job of jobs) {
    if (!object(job) || !JOBS.has(job.name) || byName.has(job.name) || job.type !== 'build' || job.status !== 'success') fail('job graph contains an invalid or unsuccessful job');
    byName.set(job.name, job);
  }
  if (['prepare', 'quality', 'security', 'acceptance'].some((name) => !byName.has(name))) fail('job graph lacks required jobs');
  if (jobs.some((job) => !Array.isArray(job.dependencies) || job.dependencies.some((id) => typeof id !== 'string' || !UUID.test(id)) || typeof job.id !== 'string' || !UUID.test(job.id) || new Set(job.dependencies).size !== job.dependencies.length)) fail('job dependencies are malformed');
  const byId = new Map(jobs.map((job) => [job.id, job]));
  if (byId.size !== jobs.length) fail('duplicate job identity');
  const visited = new Set(); const active = new Set();
  function visit(id) {
    if (active.has(id)) fail('job graph contains a cycle');
    if (visited.has(id)) return;
    const job = byId.get(id);
    if (!job) fail('unknown job dependency');
    active.add(id);
    for (const dependency of job.dependencies) visit(dependency);
    active.delete(id); visited.add(id);
  }
  visit(byName.get('acceptance').id);
  if (visited.size !== jobs.length) fail('acceptance does not depend on every job');
  if (expected) {
    const required = new Set(['prepare', ...expected.validators, 'acceptance']);
    if (byName.size !== required.size || [...required].some((name) => !byName.has(name))) fail('job set differs from trusted plan');
    for (const job of jobs) {
      const wanted = job.name === 'prepare' ? [] : job.name === 'acceptance' ? expected.validators.map((name) => byName.get(name).id) : [byName.get('prepare').id];
      if (wanted.length !== job.dependencies.length || wanted.some((id) => !job.dependencies.includes(id))) fail('job dependencies differ from trusted plan');
    }
  }
  captureJobs(jobs.map((job) => `${job.name}:${job.id}`).sort().join(','));
  return { workflowId, sha: expectedSha, jobCount: jobs.length, accessMode: token ? 'authenticated-api' : 'public-api' };
}

// The trusted caller independently verifies the GitHub PR number, base, head and
// merge-tree equivalence and computes the plan from trusted checkout data.
export async function verifyPullRequestWorkflow({ workflowId, plan, pullNumber, headRef, baseRef, ...options }) {
  if (!Number.isSafeInteger(pullNumber) || pullNumber < 1 || !['main', 'develop'].includes(baseRef) || typeof headRef !== 'string' || !headRef || headRef.length > 255 || [...headRef].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) fail('PR identity is invalid');
  const [{ parseImpactPlan }, { continuationConfig }, { readFile }] = await Promise.all([
    import('./impact.mjs'), import('./setup.mjs'), import('node:fs/promises'),
  ]);
  let trustedPlan;
  try { trustedPlan = parseImpactPlan(plan); } catch { fail('expected plan is invalid'); }
  if (trustedPlan.trigger !== 'pull_request' || trustedPlan.forceFull) fail('expected PR plan is invalid');
  const setupConfig = await readFile(new URL('../../.circleci/config.yml', import.meta.url), 'utf8');
  return verifyCircleCI({ ...options, workflowId, expectedSha: trustedPlan.headSha, expected: { headRef, validators: trustedPlan.validators, setupConfig, continuationConfig: continuationConfig(trustedPlan.validators, trustedPlan) } });
}

// Discovery is public and always verifies the newest pipeline, never an older green run.
export async function verifyLatestPullRequestWorkflow({ plan, pullNumber, headRef, baseRef, fetchImpl = fetch, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const { parseImpactPlan } = await import('./impact.mjs');
  let parsed;
  try { parsed = parseImpactPlan(plan); } catch { fail('expected plan is invalid'); }
  if (parsed.trigger !== 'pull_request' || parsed.forceFull || !Number.isSafeInteger(pullNumber) || pullNumber < 1 || !['main', 'develop'].includes(baseRef) || typeof headRef !== 'string' || !headRef || headRef.length > 255 || [...headRef].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) fail('PR identity is invalid');
  const deadline = now() + DEADLINE_MS;
  async function pages(path, separator) {
    const items = []; const seen = new Set(); let token = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await request(path + (token === null ? '' : `${separator}page-token=${encodeURIComponent(token)}`), undefined, fetchImpl, deadline, now);
      if (!object(data) || !Array.isArray(data.items) || !(data.next_page_token == null || (typeof data.next_page_token === 'string' && data.next_page_token.length > 0 && data.next_page_token.length <= 512))) fail('discovery page is malformed');
      items.push(...data.items);
      if (items.length > 200) fail('discovery contains too many entries');
      if (data.next_page_token == null) return items;
      if (seen.has(data.next_page_token)) fail('discovery pagination repeated');
      seen.add(data.next_page_token); token = data.next_page_token;
    }
    fail('too many discovery pages');
  }
  async function latest() {
    const pipelines = await pages(`/project/${PROJECT}/pipeline?branch=${encodeURIComponent(headRef)}`, '&');
    const numbers = new Set(); const ids = new Set();
    for (const pipeline of pipelines) {
      if (!object(pipeline) || pipeline.project_slug !== PROJECT || !UUID.test(pipeline.id ?? '') || !Number.isSafeInteger(pipeline.number) || pipeline.number < 1 || numbers.has(pipeline.number) || ids.has(pipeline.id)) fail('pipeline discovery is malformed');
      numbers.add(pipeline.number); ids.add(pipeline.id);
    }
    return pipelines.sort((a, b) => b.number - a.number)[0];
  }
  async function workflows(pipelineId) {
    const entries = await pages(`/pipeline/${pipelineId}/workflow`, '?');
    if (entries.some((entry) => !object(entry) || !UUID.test(entry.id ?? '') || entry.pipeline_id !== pipelineId || entry.project_slug !== PROJECT || !['portfolio-setup', 'portfolio-validation'].includes(entry.name))) fail('workflow discovery is malformed');
    const setups = entries.filter((entry) => entry.name === 'portfolio-setup');
    const validations = entries.filter((entry) => entry.name === 'portfolio-validation');
    if (setups.length > 1 || validations.length > 1) fail('workflow execution is ambiguous');
    return { setup: setups[0], validation: validations[0] };
  }
  let selected;
  for (let polls = 0; polls < 121; polls += 1) {
    const pipeline = await latest();
    if (pipeline && pipeline.trigger_parameters?.git?.checkout_sha === parsed.headSha) {
      if (!Array.isArray(pipeline.errors) || pipeline.errors.length) fail('pipeline contains errors');
      const found = await workflows(pipeline.id);
      if (found.setup && !['success', 'running', 'not_run', 'queued'].includes(found.setup.status)) fail('setup workflow did not succeed');
      if (found.validation && !['success', 'running', 'not_run', 'queued'].includes(found.validation.status)) fail('validation workflow did not succeed');
      if (found.setup?.status === 'success' && found.validation) { selected = { pipeline, ...found }; break; }
    }
    if (polls === 120 || now() + POLL_MS >= deadline) fail('latest pipeline did not become available');
    await sleep(POLL_MS);
  }
  let firstJobs;
  const result = await verifyPullRequestWorkflow({ workflowId: selected.validation.id, plan: parsed, pullNumber, headRef, baseRef, fetchImpl, now, sleep, captureJobs: (value) => { firstJobs = value; } });
  let finalJobs;
  await verifyPullRequestWorkflow({ workflowId: selected.validation.id, plan: parsed, pullNumber, headRef, baseRef, fetchImpl, now, sleep, captureJobs: (value) => { finalJobs = value; } });
  if (!firstJobs || firstJobs !== finalJobs) fail('job execution was superseded');
  const newest = await latest();
  if (!newest || newest.id !== selected.pipeline.id || newest.number !== selected.pipeline.number) fail('pipeline was superseded');
  const confirmed = await workflows(newest.id);
  if (confirmed.setup?.id !== selected.setup.id || confirmed.setup.status !== 'success' || confirmed.validation?.id !== selected.validation.id || confirmed.validation.status !== 'success') fail('workflow was superseded');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyCircleCI({ workflowId: process.env.CIRCLECI_WORKFLOW_ID, expectedSha: process.env.EXPECTED_SHA, token: process.env.CIRCLECI_API_TOKEN });
    console.log(`CircleCI ${result.accessMode === 'public-api' ? 'public API verification' : 'authenticated API verification'}: workflow ${result.workflowId} succeeded for ${result.sha}; ${result.jobCount} jobs verified. This is additive evidence, not release authorization.`);
  } catch (error) {
    console.error(error instanceof Error && error.message.startsWith('CircleCI verification failed:') ? error.message : 'CircleCI verification failed');
    process.exitCode = 1;
  }
}
