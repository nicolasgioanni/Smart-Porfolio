import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { privatePreviewEnabled } from "./previewAccess.mjs";

const failure = () => new Error("The existing preview deployment environment could not be verified.");

async function readJson(url, token, fetcher) {
  const controller = new AbortController();
  let reader, timer;
  const operation = (async () => {
    const response = await fetcher(url, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" }, redirect: "manual", signal: controller.signal });
    if (response.status !== 200 || !/^application\/json\b/i.test(response.headers.get("content-type") ?? "") || !response.body) throw failure();
    reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (Object.prototype.toString.call(part.value) !== "[object Uint8Array]" || (size += part.value.length) > 65536) throw failure();
      chunks.push(part.value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  })();
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); void reader?.cancel().catch(() => {}); reject(failure()); }, 10_000); });
  try { return await Promise.race([operation, deadline]); } catch { throw failure(); }
  finally { clearTimeout(timer); void operation.catch(() => {}); }
}

export async function verifyPreviewEnvironment({ environment = process.env, fetcher = fetch } = {}) {
  const repo = environment.GITHUB_REPOSITORY;
  if (typeof repo !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || !environment.GH_TOKEN) throw failure();
  const root = `https://api.github.com/repos/${repo}/environments/preview`;
  const [settings, branches] = await Promise.all([readJson(root, environment.GH_TOKEN, fetcher), readJson(`${root}/deployment-branch-policies?per_page=100`, environment.GH_TOKEN, fetcher)]);
  if (settings.name !== "preview" || settings.deployment_branch_policy?.protected_branches !== false ||
      settings.deployment_branch_policy?.custom_branch_policies !== true || !Array.isArray(settings.protection_rules) ||
      settings.protection_rules.filter((rule) => rule.type === "branch_policy").length !== 1 ||
      settings.protection_rules.some((rule) => !["branch_policy", "wait_timer", "required_reviewers"].includes(rule.type)) ||
      settings.can_admins_bypass !== false ||
      branches.total_count !== 1 || !Array.isArray(branches.branch_policies) || branches.branch_policies.length !== 1 ||
      branches.branch_policies[0].name !== "develop" ||
      (Object.hasOwn(branches.branch_policies[0], "type") && branches.branch_policies[0].type !== "branch")) throw failure();
}

async function main() {
  const enabled = privatePreviewEnabled();
  const selected = enabled && process.env.CI_DEPLOY_TARGET === "preview";
  if (selected) await verifyPreviewEnvironment();
  await appendFile(process.env.GITHUB_OUTPUT, `environment=${selected ? "preview" : ""}\nenabled=${selected ? "true" : "false"}\n`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
