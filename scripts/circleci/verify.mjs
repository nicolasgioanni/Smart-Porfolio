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
const STATUS_URL = /^https:\/\/app\.circleci\.com\/pipelines\/circleci\/KQ3AcKmoBm6ME2ewoJjyBd\/D2FVgecxDxnu3fC6LxpR1h\/[1-9][0-9]{0,15}\/workflows\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\/jobs\/[1-9][0-9]{0,15}$/;
const fail = (reason) => { throw new Error(`CircleCI verification failed: ${reason}`); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function validRepository(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/nicolasgioanni\/Smart-Porfolio(?:\.git)?$/.test(url.pathname);
  } catch { return false; }
}

export function eventInputs(env) {
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') return { workflowId: env.CIRCLECI_WORKFLOW_ID, expectedSha: env.EXPECTED_SHA };
  if (env.GITHUB_EVENT_NAME === 'status') {
    if (env.STATUS_STATE !== 'success' || env.STATUS_CONTEXT !== 'ci/circleci: acceptance' || typeof env.STATUS_TARGET_URL !== 'string' || env.STATUS_TARGET_URL.length > 512) fail('status event is invalid');
    const match = STATUS_URL.exec(env.STATUS_TARGET_URL);
    if (!match) fail('status target URL is invalid');
    return { workflowId: match[1], expectedSha: env.STATUS_SHA };
  }
  fail('unsupported event');
}

async function request(path, token, fetchImpl, deadline, now) {
  const remaining = deadline - now();
  if (remaining <= 0) fail('deadline exceeded');
  let response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      headers: { 'Circle-Token': token, Accept: 'application/json' },
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

export async function verifyCircleCI({ workflowId, expectedSha, token, fetchImpl = fetch, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  if (!UUID.test(workflowId ?? '') || !SHA.test(expectedSha ?? '')) fail('workflow ID or expected SHA is invalid');
  if (typeof token !== 'string' || !token.trim()) fail('CIRCLECI_API_TOKEN is required');
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
  if (!object(pipeline) || pipeline.id !== workflow.pipeline_id || pipeline.project_slug !== PROJECT || !object(pipeline.vcs) || pipeline.vcs.revision !== expectedSha || !Array.isArray(pipeline.errors) || pipeline.errors.length !== 0) fail('pipeline identity or errors are invalid');
  for (const field of ['pipeline_definition_id', 'definition_id']) {
    if (field in pipeline && pipeline[field] !== DEFINITION) fail('pipeline definition is invalid');
  }
  const urls = ['target_repository_url', 'origin_repository_url'].filter((field) => field in pipeline.vcs).map((field) => pipeline.vcs[field]);
  if (!urls.length || urls.some((url) => !validRepository(url))) fail('pipeline repository is invalid');
  const jobs = []; const seenPages = new Set(); let pageToken = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = pageToken === null ? '' : `?page-token=${encodeURIComponent(pageToken)}`;
    const data = await request(`/workflow/${workflowId}/job${query}`, token, fetchImpl, deadline, now);
    if (!object(data) || !Array.isArray(data.items) || !('next_page_token' in data) || !(data.next_page_token === null || (typeof data.next_page_token === 'string' && data.next_page_token.length > 0 && data.next_page_token.length <= 512))) fail('job page is malformed');
    jobs.push(...data.items);
    if (jobs.length > MAX_JOBS) fail('too many jobs');
    if (data.next_page_token === null) { pageToken = null; break; }
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
  return { workflowId, sha: expectedSha, jobCount: jobs.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyCircleCI({ ...eventInputs(process.env), token: process.env.CIRCLECI_API_TOKEN });
    console.log(`CircleCI workflow ${result.workflowId} succeeded for ${result.sha}; ${result.jobCount} jobs verified. This is additive evidence, not release authorization.`);
  } catch (error) {
    console.error(error instanceof Error && error.message.startsWith('CircleCI verification failed:') ? error.message : 'CircleCI verification failed');
    process.exitCode = 1;
  }
}
