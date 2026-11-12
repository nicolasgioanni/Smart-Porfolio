import { execFileSync } from "node:child_process";
import { assertSha } from "./plan.mjs";
import { generatedContentPath } from "./snapshot.mjs";

// Inspect only names and metadata. Never include source content or unbounded Git output in errors.
export function assertSourceIdentity(projectRoot, sourceSha, { allowGenerated = false, stage = "source admission" } = {}) {
  assertSha(sourceSha, "Accepted source revision");
  const git = (...args) => {
    try {
      return execFileSync("git", ["-c", "core.filemode=true", "-c", "core.ignoreStat=false", ...args], { cwd: projectRoot, encoding: "buffer", maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, stdio: ["ignore", "pipe", "ignore"] });
    } catch { throw new Error("Unable to inspect accepted Git source identity."); }
  };
  const head = git("rev-parse", "--verify", "HEAD").toString("ascii").trim();
  if (head !== sourceSha) throw new Error("Checkout/run identity differs from the accepted candidate.");
  const failures = [];
  const inspect = (label, bytes, permitGenerated) => {
    const fields = bytes.toString("utf8").split("\0");
    for (let i = 0; i < fields.length - 1; i += 2) {
      const header = fields[i], name = fields[i + 1];
      if (!/^:[0-7]{6} [0-7]{6} [0-9a-f]+ [0-9a-f]+ [A-Z]$/.test(header) || name === undefined) {
        throw new Error("Unable to inspect accepted Git source identity.");
      }
      if (permitGenerated && name === generatedContentPath && /^:100644 100644 [0-9a-f]+ [0-9a-f]+ M$/.test(header)) continue;
      failures.push(`${label}: ${JSON.stringify(name).slice(0, 240)}`);
    }
  };
  inspect("index", git("diff", "--cached", "--raw", "-z", "--no-renames", "--no-ext-diff", "--no-textconv", "--ignore-submodules=none", sourceSha, "--"), false);
  inspect("worktree", git("diff", "--raw", "-z", "--no-renames", "--no-ext-diff", "--no-textconv", "--ignore-submodules=none", "--"), allowGenerated);
  const flags = git("ls-files", "-v", "-z").toString("utf8").split("\0").filter(Boolean);
  for (const entry of flags) if (entry[0] !== "H") failures.push(`index flag: ${JSON.stringify(entry.slice(2)).slice(0, 240)}`);
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z").toString("utf8").split("\0").filter(Boolean);
  for (const name of untracked) failures.push(`untracked: ${JSON.stringify(name).slice(0, 240)}`);
  if (failures.length) throw new Error(`Accepted source has changes during ${stage}: ${failures.slice(0, 10).join(", ")}${failures.length > 10 ? " (additional paths omitted)" : ""}. Restore the accepted checkout and rerun all affected validation.`);
}
