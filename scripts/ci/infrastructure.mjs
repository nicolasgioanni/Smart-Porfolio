import { execFile } from "node:child_process";
import { readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "../..");

export async function discoverTerraformRoots(root = projectRoot) {
  const roots = [];
  for (const group of ["modules", "states"]) {
    const directory = path.join(root, "infra", group);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-z][a-z0-9-]*$/.test(entry.name)) throw new Error("Infrastructure ownership contains an unsupported root.");
      const relative = `infra/${group}/${entry.name}`;
      for (const file of ["main.tf", ".terraform.lock.hcl"]) {
        if (!(await lstat(path.join(root, relative, file))).isFile()) throw new Error("Every infrastructure root requires regular source and provider-lock files.");
      }
      const tests = await readdir(path.join(root, relative, "tests"), { withFileTypes: true });
      if (!tests.some((test) => test.isFile() && test.name.endsWith(".tftest.hcl"))) throw new Error("Every infrastructure root requires a credential-free mock suite.");
      roots.push(relative);
    }
  }
  if (!roots.length) throw new Error("No infrastructure roots were discovered.");
  return roots.sort();
}

// This is deliberately backend-disabled and mock-only. The separate saved-plan
// guard inspects private adoption evidence; this runner cannot import or apply.
export async function verifyOfflineInfrastructure({ root = projectRoot, terraform, opa,
  environment = process.env, run = execute, discover = discoverTerraformRoots } = {}) {
  for (const binary of [terraform, opa]) if (typeof binary !== "string" || !path.isAbsolute(binary)) throw new Error("Checksum-verified infrastructure binaries require absolute paths.");
  const roots = await discover(root);
  const childEnvironment = { PATH: environment.PATH, HOME: environment.HOME, TMPDIR: environment.TMPDIR,
    LANG: "C.UTF-8", TF_INPUT: "false", TF_IN_AUTOMATION: "true", CHECKPOINT_DISABLE: "1",
    TF_CLI_CONFIG_FILE: "/dev/null", TERRAFORM_BIN: terraform, OPA_BIN: opa };
  let completed = 0;
  const command = async (binary, args, label) => {
    try {
      await run(binary, args, { cwd: root, env: childEnvironment, timeout: 10 * 60_000, maxBuffer: 20 * 1024 * 1024 });
      completed += 1;
    } catch {
      // Provider-shaped test output is private diagnostic material. Do not
      // expose captured stdout/stderr or arbitrary provider errors to Actions.
      throw new Error(`Offline infrastructure check failed: ${label}. Reproduce with the documented credential-free commands.`);
    }
  };
  await command(process.execPath, ["infra/validate-ownership.mjs"], "ownership");
  await command(terraform, ["fmt", "-check", "-recursive", "infra"], "format");
  for (const directory of roots) {
    await command(terraform, [`-chdir=${directory}`, "init", "-backend=false", "-lockfile=readonly", "-input=false", "-no-color"], `${directory} initialization`);
    await command(terraform, [`-chdir=${directory}`, "validate", "-no-color"], `${directory} validation`);
    await command(terraform, [`-chdir=${directory}`, "test", "-no-color"], `${directory} mock tests`);
  }
  await command(process.execPath, ["--test", "infra/tests/saved-plan.test.mjs", "infra/tests/check-plan.test.mjs", "infra/tests/mock-plan-export.test.mjs"], "saved-plan and OPA policies");
  return { roots: roots.length, completed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: node scripts/ci/infrastructure.mjs <terraform> <opa>");
    console.log(JSON.stringify(await verifyOfflineInfrastructure({ terraform: process.argv[2], opa: process.argv[3] })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
