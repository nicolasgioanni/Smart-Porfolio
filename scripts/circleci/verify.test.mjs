import { describe, expect, it, vi } from 'vitest';
import { eventInputs, verifyCircleCI } from './verify.mjs';

const workflowId = '11111111-1111-4111-8111-111111111111';
const pipelineId = '22222222-2222-4222-8222-222222222222';
const sha = 'a'.repeat(40);
const project = 'circleci/KQ3AcKmoBm6ME2ewoJjyBd/D2FVgecxDxnu3fC6LxpR1h';
const token = 'secret-token-never-print';
const workflow = () => ({ id: workflowId, pipeline_id: pipelineId, name: 'portfolio-validation', status: 'success', project_slug: project });
const pipeline = () => ({ id: pipelineId, project_slug: project, vcs: { revision: sha, origin_repository_url: 'https://github.com/nicolasgioanni/Smart-Porfolio' }, errors: [] });
const id = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const appPipeline = () => ({ id: pipelineId, project_slug: project, errors: [], trigger_parameters: { circleci: { trigger_type: 'github_app', event_type: 'pull_request' }, github_app: { repo_url: 'https://github.com/nicolasgioanni/Smart-Porfolio', repo_full_name: 'nicolasgioanni/Smart-Porfolio', commit_sha: sha, pull_request_head_sha: sha }, git: { repo_url: 'https://github.com/nicolasgioanni/Smart-Porfolio', checkout_sha: sha } } });
const jobs = () => [
  { id: id(1), name: 'prepare', type: 'build', status: 'success', dependencies: [] },
  { id: id(2), name: 'quality', type: 'build', status: 'success', dependencies: [id(1)] },
  { id: id(3), name: 'security', type: 'build', status: 'success', dependencies: [id(1)] },
  { id: id(4), name: 'acceptance', type: 'build', status: 'success', dependencies: [id(2), id(3)] },
];
function setup({ w = workflow(), p = pipeline(), pages = [{ items: jobs(), next_page_token: null }] } = {}) {
  let index = 0;
  const fetchImpl = vi.fn(async (url) => {
    const value = url.includes('/job') ? pages[index++] : url.endsWith(workflowId) ? w : p;
    return new Response(JSON.stringify(value), { status: 200 });
  });
  return { fetchImpl, run: () => verifyCircleCI({ workflowId, expectedSha: sha, token, fetchImpl }) };
}

describe('authenticated CircleCI completion', () => {
  it('binds the successful workflow, pipeline, and job graph', async () => {
    const { fetchImpl, run } = setup();
    expect(await run()).toEqual({ workflowId, sha, jobCount: 4, accessMode: 'authenticated-api' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [url, options] of fetchImpl.mock.calls) {
      expect(url.startsWith('https://circleci.com/api/v2/')).toBe(true);
      expect(options.redirect).toBe('error');
      expect(options.headers['Circle-Token']).toBe(token);
    }
  });
  it('accepts the observed GitHub App checkout identity', async () => {
    expect((await setup({ p: appPipeline() }).run()).sha).toBe(sha);
    expect((await setup({ p: { ...pipeline(), trigger_parameters: appPipeline().trigger_parameters } }).run()).sha).toBe(sha);
  });
  it('follows bounded page tokens without trusting URLs', async () => {
    const { run, fetchImpl } = setup({ pages: [{ items: jobs().slice(0, 2), next_page_token: 'x&other=1' }, { items: jobs().slice(2), next_page_token: null }] });
    expect((await run()).jobCount).toBe(4);
    expect(fetchImpl.mock.calls[3][0]).toContain('?page-token=x%26other%3D1');
  });
  it.each([
    ['missing app checkout', { p: { ...appPipeline(), trigger_parameters: { ...appPipeline().trigger_parameters, git: {} } } }],
    ['wrong app checkout SHA', { p: { ...appPipeline(), trigger_parameters: { ...appPipeline().trigger_parameters, git: { ...appPipeline().trigger_parameters.git, checkout_sha: 'b'.repeat(40) } } } }],
    ['partial app event', { p: { ...appPipeline(), trigger_parameters: { ...appPipeline().trigger_parameters, github_app: { commit_sha: sha } } } }],
    ['app without checkout', { p: { ...appPipeline(), trigger_parameters: { circleci: { trigger_type: 'github_app' }, github_app: appPipeline().trigger_parameters.github_app } } }],
    ['checkout without app', { p: { ...appPipeline(), trigger_parameters: { circleci: { trigger_type: 'github_app' }, git: appPipeline().trigger_parameters.git } } }],
    ['wrong app commit SHA', { p: { ...appPipeline(), trigger_parameters: { ...appPipeline().trigger_parameters, github_app: { ...appPipeline().trigger_parameters.github_app, commit_sha: 'b'.repeat(40) } } } }],
    ['wrong app repository', { p: { ...appPipeline(), trigger_parameters: { ...appPipeline().trigger_parameters, github_app: { ...appPipeline().trigger_parameters.github_app, repo_url: 'https://evil.test/repo' } } } }],
    ['wrong git repository', { p: { ...appPipeline(), trigger_parameters: { ...appPipeline().trigger_parameters, git: { ...appPipeline().trigger_parameters.git, repo_url: 'https://evil.test/repo' } } } }],
    ['contradictory representations', { p: { ...pipeline(), trigger_parameters: { ...appPipeline().trigger_parameters, git: { ...appPipeline().trigger_parameters.git, checkout_sha: 'b'.repeat(40) } } } }],
    ['missing identity', { p: { id: pipelineId, project_slug: project, errors: [] } }],
    ['stale SHA', { p: { ...pipeline(), vcs: { ...pipeline().vcs, revision: 'b'.repeat(40) } } }],
    ['wrong workflow project', { w: { ...workflow(), project_slug: 'other' } }],
    ['wrong pipeline project', { p: { ...pipeline(), project_slug: 'other' } }],
    ['wrong workflow', { w: { ...workflow(), name: 'setup' } }],
    ['wrong definition', { p: { ...pipeline(), pipeline_definition_id: 'other' } }],
    ['spoofed repository', { p: { ...pipeline(), vcs: { ...pipeline().vcs, origin_repository_url: 'https://github.com.evil.test/nicolasgioanni/Smart-Porfolio' } } }],
    ['repository credentials', { p: { ...pipeline(), vcs: { ...pipeline().vcs, origin_repository_url: 'https://github.com@evil.test/nicolasgioanni/Smart-Porfolio' } } }],
    ['missing repository', { p: { ...pipeline(), vcs: { revision: sha } } }],
    ['pipeline errors', { p: { ...pipeline(), errors: [{}] } }],
    ['missing errors', { p: { ...pipeline(), errors: undefined } }],
    ['skipped job', { pages: [{ items: jobs().map((job) => job.name === 'quality' ? { ...job, status: 'not_run' } : job), next_page_token: null }] }],
    ['approval', { pages: [{ items: jobs().map((job) => job.name === 'quality' ? { ...job, type: 'approval' } : job), next_page_token: null }] }],
    ['failed job', { pages: [{ items: jobs().map((job) => job.name === 'quality' ? { ...job, status: 'failed' } : job), next_page_token: null }] }],
    ['unknown job', { pages: [{ items: [...jobs(), { name: 'other', type: 'build', status: 'success' }], next_page_token: null }] }],
    ['empty graph', { pages: [{ items: [], next_page_token: null }] }],
    ['prepare is not a validator', { pages: [{ items: [{ name: 'prepare', type: 'build', status: 'success' }, jobs()[1]], next_page_token: null }] }],
    ['no validator', { pages: [{ items: [jobs()[1]], next_page_token: null }] }],
    ['malformed page', { pages: [{ items: jobs() }] }],
    ['repeated token', { pages: [{ items: [], next_page_token: 'x' }, { items: [], next_page_token: 'x' }] }],
    ['missing security', { pages: [{ items: jobs().filter((job) => job.name !== 'security'), next_page_token: null }] }],
    ['missing dependencies', { pages: [{ items: jobs().map((job) => ({ ...job, dependencies: undefined })), next_page_token: null }] }],
    ['cycle', { pages: [{ items: jobs().map((job) => job.name === 'prepare' ? { ...job, dependencies: [id(4)] } : job), next_page_token: null }] }],
    ['self edge', { pages: [{ items: jobs().map((job) => job.name === 'prepare' ? { ...job, dependencies: [id(1)] } : job), next_page_token: null }] }],
    ['duplicate edge', { pages: [{ items: jobs().map((job) => job.name === 'quality' ? { ...job, dependencies: [id(1), id(1)] } : job), next_page_token: null }] }],
    ['unreachable job', { pages: [{ items: jobs().map((job) => job.name === 'acceptance' ? { ...job, dependencies: [id(2)] } : job), next_page_token: null }] }],
    ['dangling edge', { pages: [{ items: jobs().map((job) => job.name === 'prepare' ? { ...job, dependencies: [id(9)] } : job), next_page_token: null }] }],
  ])('rejects %s', async (_name, options) => { await expect(setup(options).run()).rejects.toThrow('CircleCI verification failed'); });
  it('supports public API access without sending an authentication header', async () => {
    for (const optionalToken of ['', undefined]) {
      const { fetchImpl } = setup();
      const result = await verifyCircleCI({ workflowId, expectedSha: sha, token: optionalToken, fetchImpl });
      expect(result.accessMode).toBe('public-api');
      for (const [url, options] of fetchImpl.mock.calls) {
        expect(url.startsWith('https://circleci.com/api/v2/')).toBe(true);
        expect(options.headers).not.toHaveProperty('Circle-Token');
      }
    }
  });
  it('rejects invalid credentials and inputs before requests', async () => {
    const fetchImpl = vi.fn();
    for (const invalidToken of ['   ', 42, null]) await expect(verifyCircleCI({ workflowId, expectedSha: sha, token: invalidToken, fetchImpl })).rejects.toThrow('CIRCLECI_API_TOKEN');
    await expect(verifyCircleCI({ workflowId: '../../evil', expectedSha: sha, token, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('does not retry failed authentication without the token', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 403 }));
    await expect(verifyCircleCI({ workflowId, expectedSha: sha, token, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].headers['Circle-Token']).toBe(token);
  });
  it('rejects HTTP errors, redirects, malformed responses, and redacts transport errors', async () => {
    for (const fetchImpl of [
      async () => new Response('', { status: 403 }),
      async () => { throw new Error(`redirect to https://evil.test/${token}`); },
      async () => new Response('{broken', { status: 200 }),
    ]) {
      await expect(verifyCircleCI({ workflowId, expectedSha: sha, token, fetchImpl })).rejects.toThrow('API request failed or returned malformed data');
      try { await verifyCircleCI({ workflowId, expectedSha: sha, token, fetchImpl }); } catch (error) { expect(String(error)).not.toContain(token); }
    }
  });
  it('fails closed on a workflow that never completes', async () => {
    let time = 0;
    const { fetchImpl } = setup({ w: { ...workflow(), status: 'running' } });
    await expect(verifyCircleCI({ workflowId, expectedSha: sha, token, fetchImpl, now: () => time, sleep: async (ms) => { time += ms; } })).rejects.toThrow('timed out');
  });
});

const currentStatusUrl = `https://app.circleci.com/workflow/${workflowId}/job/22222222-2222-4222-8222-222222222222`;
const statusUrl = `https://app.circleci.com/pipelines/circleci/KQ3AcKmoBm6ME2ewoJjyBd/D2FVgecxDxnu3fC6LxpR1h/123/workflows/${workflowId}/jobs/456`;
describe('status event inputs', () => {
  const env = { GITHUB_EVENT_NAME: 'status', STATUS_STATE: 'success', STATUS_CONTEXT: 'ci/circleci: acceptance', STATUS_SHA: sha, STATUS_TARGET_URL: statusUrl };
  it('extracts only a strictly shaped CircleCI workflow URL', () => {
    expect(eventInputs(env)).toEqual({ workflowId, expectedSha: sha });
    expect(eventInputs({ ...env, STATUS_TARGET_URL: currentStatusUrl })).toEqual({ workflowId, expectedSha: sha });
    expect(eventInputs({ GITHUB_EVENT_NAME: 'workflow_dispatch', CIRCLECI_WORKFLOW_ID: workflowId, EXPECTED_SHA: sha })).toEqual({ workflowId, expectedSha: sha });
  });
  it.each([
    statusUrl + '?x=1', statusUrl + '#x', statusUrl.replace('app.circleci.com', 'app.circleci.com.evil.test'),
    statusUrl.replace('https://', 'https://user@'), statusUrl.replace('D2FVgecxDxnu3fC6LxpR1h', 'other'),
    statusUrl.replace('/123/', '/0/'), statusUrl.replace('/jobs/456', ''),
    currentStatusUrl + '?x=1', currentStatusUrl + '#x',
    currentStatusUrl.replace('app.circleci.com', 'app.circleci.com.evil.test'),
    currentStatusUrl.replace('https://', 'https://user@'),
    currentStatusUrl.replace('/job/', '/jobs/'), currentStatusUrl.replace('22222222-2222-4222-8222-222222222222', 'invalid'),
  ])('rejects untrusted target %s', (url) => { expect(() => eventInputs({ ...env, STATUS_TARGET_URL: url })).toThrow(); });
  it('rejects a mismatched status context or state', () => {
    expect(() => eventInputs({ ...env, STATUS_CONTEXT: 'other' })).toThrow();
    expect(() => eventInputs({ ...env, STATUS_STATE: 'pending' })).toThrow();
  });
});
