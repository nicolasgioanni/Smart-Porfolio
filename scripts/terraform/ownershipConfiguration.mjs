import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const reviewedProviderLocks = new Map([
  ["registry.terraform.io/cloudflare/cloudflare", {
    version: "5.27.0",
    constraints: "5.27.0",
    hashes: [
      "h1:9YNVP8ZdD+Pp5Lu+oJ7AmXMNZ5gnpYgwEpGmcfpwSiQ=",
      "zh:0af697c42fc9c5c7359e9209dd2502784789d07dd803ef8ed0e9e1dbc0aea0ff",
      "zh:234be996462aaa9556e024f8434c238cc70bd84960283a4a85d0e096efd9f8c7",
      "zh:56220ac018b93fcac2ad249b668eb9699f1a1f32970eacda05970e3710f8b5d9",
      "zh:7323d107b46ddb1456c2f1d939eaf28e81376203de482d15c1cfe1881903c96e",
      "zh:74b61025e456b944794017ba6b6040f478149964a45f5d328d1dc240b43b8153",
      "zh:77e1b14dd89dd8d6574db4ecb1a5a313480bf1b2e2c29aa86c4f864aa29f74cf",
      "zh:a7893a8def71e5473f6b462accad02fc7f0f842caf03bcd49d3443768d78b9be",
      "zh:ae47a9f29594d57e634cc0b5b96a18da5a364f43cbd735622ce5fe808728065f",
      "zh:f809ab383cca0a5f83072981c64208cbd7fa67e986a86ee02dd2c82333221e32",
    ],
  }],
  ["registry.terraform.io/integrations/github", {
    version: "6.13.0",
    constraints: "6.13.0",
    hashes: [
      "h1:y0Sujto8gttV86innNp/LTMzq7CqsFpBs7XKH8AlMl4=",
      "zh:0ab29fc21699f34345cf0bbbe44745fd1b143b7c73b410c1dc4abe05ffad0a84",
      "zh:1aed10d06755d420bb3a893bf548ab2932297a9d094c04c5a8501e949ca186ed",
      "zh:2a6a11c21eae408055f45b9533c07afd2e845f6d496fd1b645aec2e873012103",
      "zh:5dd05dee677f6ebdbed00cbb1b9be444ab2d1062d345cbc9ec50a47cb41b8622",
      "zh:6b757d034831243d67ddda869eac4368cef539848bd97511f4d68f1aa38a9c88",
      "zh:947c9b5b238f0364c57a705beabd24d3eea3159a6f3a24c07e3fbb13657ffae0",
      "zh:a676549a98164b61630658cbeb6c17820331ca04a049dc9b5095996a0c31ffbe",
      "zh:a8a81b7fe41dd61eb6a6fa5e08a4dd9ee070e862868252a7fd4cfce30364efee",
      "zh:c26a9bca4865665084e7f59b1402d7aff34ee63a418d7401a0658fa280cad4d4",
      "zh:c638d8d0762e62ea188f86302954ef4c92803f2160f0a45fca0cd13974bd3725",
      "zh:e739a0b7e81ca816944a18a38e679f4015edf8be7ac319815cdea865ba7727d7",
      "zh:ec099487ea3de8999c84b3b791e242d728461e51fe344832b37bd8d521201c77",
      "zh:f016ff9e2daab5b88185cec0795213049d105439ffd585d3309a714514ccae13",
      "zh:fbd1fee2c9df3aa19cf8851ce134dea6e45ea01cb85695c1726670c285797e25",
    ],
  }],
]);
const expectedRoots = new Map([
  ["shared", { directory: "infra/roots/shared", environment: "shared", providers: ["registry.terraform.io/cloudflare/cloudflare"], resourceAddresses: [] }],
  ["preview", { directory: "infra/roots/preview", environment: "preview", providers: ["registry.terraform.io/cloudflare/cloudflare"], resourceAddresses: ["cloudflare_d1_database.contact_rate_limit"] }],
  ["production", { directory: "infra/roots/production", environment: "production", providers: ["registry.terraform.io/cloudflare/cloudflare"], resourceAddresses: ["cloudflare_d1_database.contact_rate_limit"] }],
  ["github-governance", { directory: "infra/roots/github-governance", environment: "github-governance", providers: ["registry.terraform.io/integrations/github"], resourceAddresses: ["github_repository_ruleset.permanent_branches"] }],
]);
const expectedResources = new Map([
  ["preview:cloudflare_d1_database.contact_rate_limit", {
    root: "preview",
    address: "cloudflare_d1_database.contact_rate_limit",
    environment: "preview",
    provider: "registry.terraform.io/cloudflare/cloudflare",
    expectedName: "smart-portfolio-contact-rate-limit-preview",
    adoption: "reviewed_exact_id_required",
    migrations: "release_workflow_owned",
  }],
  ["production:cloudflare_d1_database.contact_rate_limit", {
    root: "production",
    address: "cloudflare_d1_database.contact_rate_limit",
    environment: "production",
    provider: "registry.terraform.io/cloudflare/cloudflare",
    expectedName: "smart-portfolio-contact-rate-limit-production",
    adoption: "reviewed_exact_id_required",
    migrations: "release_workflow_owned",
  }],
  ["github-governance:github_repository_ruleset.permanent_branches", {
    root: "github-governance",
    address: "github_repository_ruleset.permanent_branches",
    environment: "github-governance",
    provider: "registry.terraform.io/integrations/github",
    expectedName: "protect-permanent-branches",
    adoption: "reviewed_exact_id_required",
    rules: ["deletion", "non_fast_forward"],
    targetRefs: ["refs/heads/main", "refs/heads/develop"],
  }],
]);

function asRelative(projectPath, absolutePath) {
  return path.relative(projectPath, absolutePath).split(path.sep).join("/");
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTerraformSources(rootDirectory) {
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  const terraformFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tf"))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    terraformFiles.map(async (fileName) => ({
      fileName,
      source: await readFile(path.join(rootDirectory, fileName), "utf8"),
    })),
  );
}

function sameList(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function sameExactRecord(actual, expected) {
  const actualKeys = Object.keys(actual ?? {}).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (!sameList(actualKeys, expectedKeys)) return false;
  return expectedKeys.every((key) => Array.isArray(expected[key])
    ? sameList(actual[key], expected[key])
    : actual[key] === expected[key]);
}

async function assertRegularPathWithoutSymlink({ root, target, expectFile = false }) {
  const lexicalRoot = path.resolve(root);
  const lexicalTarget = path.resolve(target);
  if (!isWithin(lexicalRoot, lexicalTarget)) throw new Error("path escapes the repository root");

  let current = lexicalRoot;
  if ((await lstat(current)).isSymbolicLink()) throw new Error("repository root is symbolic link");
  const segments = path.relative(lexicalRoot, lexicalTarget).split(path.sep).filter(Boolean);
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink()) throw new Error("path contains a symbolic link");
    if (index < segments.length - 1 && !metadata.isDirectory()) throw new Error("path ancestor is not a directory");
    if (index === segments.length - 1 && expectFile && !metadata.isFile()) throw new Error("path is not a regular file");
  }
  return lexicalTarget;
}

function isOperationalArtifact(name) {
  return name === ".terraform"
    || name.endsWith(".tfstate")
    || name.includes(".tfstate.")
    || name.endsWith(".tfplan")
    || name.endsWith(".tfvars")
    || name.endsWith(".tfvars.json");
}

async function inspectInfrastructureLayout({ root, expectedRootDirectories }) {
  const infrastructureDirectory = await assertRegularPathWithoutSymlink({
    root,
    target: path.join(root, "infra"),
  });
  const errors = [];
  const queue = [{ directory: infrastructureDirectory, relative: "infra" }];
  while (queue.length > 0) {
    const { directory, relative } = queue.shift();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryRelative = `${relative}/${entry.name}`;
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        errors.push(`${entryRelative} must not be a symbolic link`);
        continue;
      }
      if (isOperationalArtifact(entry.name)) {
        errors.push(`${entryRelative} must not contain Terraform operational artifacts`);
      }
      if (!entry.isDirectory()) continue;
      if (relative === "infra" && !["roots", "schemas"].includes(entry.name)) {
        errors.push(`${entryRelative} is not an allowed infrastructure directory`);
      }
      if (relative === "infra/roots" && !expectedRootDirectories.has(entry.name)) {
        errors.push(`${entryRelative} is not a reviewed Terraform root`);
      }
      if (relative.startsWith("infra/roots/")) {
        errors.push(`${entryRelative} is not an allowed nested Terraform root directory`);
      }
      queue.push({ directory: entryPath, relative: entryRelative });
    }
  }
  return errors;
}

export async function readOwnershipManifest({ root = projectRoot } = {}) {
  try {
    const manifestPath = await assertRegularPathWithoutSymlink({
      root,
      target: path.join(root, "infra", "ownership-manifest.json"),
      expectFile: true,
    });
    return JSON.parse(
      await readFile(manifestPath, "utf8"),
    );
  } catch {
    throw new Error("ownership manifest is not readable JSON");
  }
}

export async function validateOwnershipConfiguration({ root = projectRoot } = {}) {
  const errors = [];
  let manifest;
  try {
    manifest = await readOwnershipManifest({ root });
  } catch {
    return { errors: ["ownership manifest is not readable JSON"], manifest: { roots: [], resources: [] } };
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { errors: ["ownership manifest must be an object"], manifest: { roots: [], resources: [] } };
  }
  if (!Array.isArray(manifest.roots) || !Array.isArray(manifest.resources)) {
    return { errors: ["ownership manifest must contain root and resource arrays"], manifest };
  }
  const resolvedRoot = await realpath(root);
  try {
    const expectedDirectories = new Set([...expectedRoots.values()].map(({ directory }) => path.basename(directory)));
    errors.push(...await inspectInfrastructureLayout({ root: resolvedRoot, expectedRootDirectories: expectedDirectories }));
  } catch {
    return { errors: ["Terraform infrastructure layout is not readable without symbolic links"], manifest };
  }
  if (errors.length > 0) return { errors, manifest };
  const rootNames = new Set();
  const addresses = new Set();

  if (manifest.schemaVersion !== 1) {
    errors.push("ownership manifest schemaVersion must be 1");
  }

  for (const rootEntry of manifest.roots ?? []) {
    if (!rootEntry.name || rootNames.has(rootEntry.name)) {
      errors.push(`ownership manifest has a duplicate or missing root name: ${rootEntry.name ?? "missing"}`);
      continue;
    }
    rootNames.add(rootEntry.name);
    const expectedRoot = expectedRoots.get(rootEntry.name);
    if (!expectedRoot) {
      errors.push(`ownership manifest has an unsupported root ${rootEntry.name}`);
      continue;
    }
    if (rootEntry.directory !== expectedRoot.directory || rootEntry.environment !== expectedRoot.environment || !sameList(rootEntry.providers, expectedRoot.providers) || !sameList(rootEntry.resourceAddresses, expectedRoot.resourceAddresses)) {
      errors.push(`ownership manifest has an invalid fixed contract for ${rootEntry.name}`);
      continue;
    }

    const rootDirectory = path.join(resolvedRoot, rootEntry.directory ?? "");
    const rootRelative = asRelative(root, rootDirectory);
    let rootEntries = [];
    try {
      rootEntries = await readdir(rootDirectory, { withFileTypes: true });
    } catch {
      errors.push(`${rootRelative} is not a readable Terraform root`);
      continue;
    }
    for (const entry of rootEntries) {
      if (
        entry.name.endsWith(".tf.json") ||
        entry.name === "override.tf" ||
        entry.name === "override.tf.json" ||
        entry.name.endsWith("_override.tf") ||
        entry.name.endsWith("_override.tf.json") ||
        entry.name.endsWith(".tfstate") ||
        entry.name.includes(".tfstate.") ||
        entry.name.endsWith(".tfplan") ||
        entry.name.endsWith(".tfvars") ||
        entry.name.endsWith(".tfvars.json")
      ) {
        errors.push(`${rootRelative} must not contain Terraform operational, JSON, or override configuration`);
      }
    }
    for (const requiredFile of ["versions.tf", "main.tf", "variables.tf", ".terraform.lock.hcl"]) {
      if (!(await exists(path.join(rootDirectory, requiredFile)))) {
        errors.push(`${rootRelative} is missing ${requiredFile}`);
      }
    }

    let sourceFiles = [];
    try {
      sourceFiles = await readTerraformSources(rootDirectory);
    } catch {
      errors.push(`${rootRelative} is not a readable Terraform root`);
      continue;
    }
    const combinedSource = sourceFiles.map(({ source }) => source).join("\n");
    const lockPath = path.join(rootDirectory, ".terraform.lock.hcl");
    let lockSource = "";
    try {
      lockSource = await readFile(lockPath, "utf8");
    } catch {
      // The required-file diagnostic above is more useful than a read failure.
    }

    if (/\bterraform_remote_state\b/.test(combinedSource)) {
      errors.push(`${rootRelative} must not read another root's remote state`);
    }
    if (/\bbackend\s+"/.test(combinedSource)) {
      errors.push(`${rootRelative} must not declare an activation backend`);
    }
    if (/\bcloud\s*\{/.test(combinedSource)) {
      errors.push(`${rootRelative} must not declare HCP Terraform activation configuration`);
    }
    if (/\balias\s*=/.test(combinedSource)) {
      errors.push(`${rootRelative} must not declare provider aliases`);
    }
    if (/\bmodule\s+"/.test(combinedSource)) {
      errors.push(`${rootRelative} must not declare module dependencies`);
    }

    for (const provider of rootEntry.providers ?? []) {
      const reviewedLock = reviewedProviderLocks.get(provider);
      if (!reviewedLock) {
        errors.push(`${rootRelative} names an unsupported provider ${provider}`);
        continue;
      }
      const { version } = reviewedLock;
      if (!combinedSource.includes(`version = "= ${version}"`)) {
        errors.push(`${rootRelative} must pin ${provider} to ${version}`);
      }
      const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const sourceName = provider.replace("registry.terraform.io/", "");
      const configuredSources = [...combinedSource.matchAll(/^\s*source\s*=\s*"([^"]+)"/gm)].map(([, source]) => source);
      const localName = sourceName.split("/").at(-1);
      const escapedLocalName = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!sameList(configuredSources, [sourceName]) || !new RegExp(`\\b${escapedLocalName}\\s*=\\s*\\{[\\s\\S]*?source\\s*=\\s*"${sourceName}"[\\s\\S]*?version\\s*=\\s*"= ${escapedVersion}"`).test(combinedSource)) {
        errors.push(`${rootRelative} must bind its provider local name to only ${sourceName}`);
      }
      const lockBlocks = [...lockSource.matchAll(/^provider\s+"([^"]+)"\s*\{([\s\S]*?)^\}/gm)];
      const lockedProviders = [...lockSource.matchAll(/^provider\s+"([^"]+)"/gm)].map(([, lockedProvider]) => lockedProvider);
      if (!sameList(lockedProviders, rootEntry.providers)) {
        errors.push(`${rootRelative} lock file must contain only its reviewed provider source`);
        continue;
      }
      const lockBody = lockBlocks[0]?.[2] ?? "";
      const lockVersions = [...lockBody.matchAll(/^\s*version\s+=\s+"([^"]+)"/gm)].map(([, lockedVersion]) => lockedVersion);
      const lockConstraints = [...lockBody.matchAll(/^\s*constraints\s+=\s+"([^"]+)"/gm)].map(([, constraint]) => constraint);
      const hashSections = [...lockBody.matchAll(/^\s*hashes\s*=\s*\[([\s\S]*?)^\s*\]/gm)].map(([, section]) => section);
      const hashSection = hashSections[0] ?? "";
      const lockHashes = [...hashSection.matchAll(/"([^"]+)"/g)].map(([, hash]) => hash);
      if (!sameList(lockVersions, [version])) {
        errors.push(`${rootRelative} lock file must select ${provider} ${version}`);
      }
      if (!sameList(lockConstraints, [reviewedLock.constraints])) {
        errors.push(`${rootRelative} lock file must retain reviewed provider constraints`);
      }
      if (hashSections.length !== 1 || !sameSet(lockHashes, reviewedLock.hashes) || new Set(lockHashes).size !== lockHashes.length) {
        errors.push(`${rootRelative} lock file must retain the exact reviewed provider checksum set`);
      }
    }

    const resourcesInSource = [...combinedSource.matchAll(/^\s*resource\s+"([^"]+)"\s+"([^"]+)"/gm)];
    const sourceAddresses = new Set(resourcesInSource.map(([, type, name]) => `${type}.${name}`));
    if (rootEntry.resourceAddresses?.length === 0 && resourcesInSource.length > 0) {
      errors.push(`${rootRelative} declares resources despite its empty ownership manifest entry`);
    }
    for (const address of rootEntry.resourceAddresses ?? []) {
      if (!sourceAddresses.has(address)) errors.push(`${rootRelative} is missing owned resource ${address}`);
    }
    for (const address of sourceAddresses) {
      if (!rootEntry.resourceAddresses?.includes(address)) errors.push(`${rootRelative} declares unowned resource ${address}`);
    }
    if (rootEntry.resourceAddresses?.length > 0 && !/prevent_destroy\s*=\s*true/.test(combinedSource)) {
      errors.push(`${rootRelative} must keep prevent_destroy on every adopted resource`);
    }
  }

  if (rootNames.size !== expectedRoots.size || [...expectedRoots.keys()].some((name) => !rootNames.has(name))) {
    errors.push("ownership manifest must contain exactly the shared, preview, production, and github-governance roots");
  }

  for (const resource of manifest.resources) {
    const key = `${resource.root}:${resource.address}`;
    const expectedResource = expectedResources.get(key);
    if (!rootNames.has(resource.root) || !resource.address || addresses.has(key) || !expectedResource) {
      errors.push(`ownership manifest has an unknown, duplicate, or incomplete resource: ${key}`);
      continue;
    }
    addresses.add(key);
    if (!sameExactRecord(resource, expectedResource)) {
      errors.push(`ownership manifest has an invalid fixed resource contract for ${key}`);
    }
    const rootEntry = manifest.roots.find((entry) => entry.name === resource.root);
    if (!rootEntry.resourceAddresses.includes(resource.address)) {
      errors.push(`${key} is not listed by its ownership root`);
    }
  }
  if (addresses.size !== expectedResources.size || [...expectedResources.keys()].some((key) => !addresses.has(key))) {
    errors.push("ownership manifest must contain exactly the reviewed D1 and GitHub resource contracts");
  }

  const githubRoot = path.join(root, "infra", "roots", "github-governance", "main.tf");
  if (await exists(githubRoot)) {
    const githubSource = await readFile(githubRoot, "utf8");
    if (!/deletion\s*=\s*true/.test(githubSource) || !/non_fast_forward\s*=\s*true/.test(githubSource)) {
      errors.push("github-governance must protect deletion and non-fast-forward updates");
    }
    if (/\bbypass_actors\b/.test(githubSource)) {
      errors.push("github-governance must not grant a ruleset bypass actor");
    }
    if (/\b(?:creation|required_linear_history|required_signatures|update|update_allows_fetch_and_merge)\s*=\s*true/.test(githubSource) || /\b(?:branch_name_pattern|commit_author_email_pattern|commit_message_pattern|committer_email_pattern|copilot_code_review|file_extension_restriction|file_path_restriction|max_file_path_length|max_file_size|merge_queue|pull_request|required_code_scanning|required_deployments|required_status_checks|tag_name_pattern)\s*\{/.test(githubSource)) {
      errors.push("github-governance must not add active rules beyond deletion and non-fast-forward protection");
    }
    if (!/name\s*=\s*"protect-permanent-branches"/.test(githubSource) || !/target\s*=\s*"branch"/.test(githubSource) || !/enforcement\s*=\s*"active"/.test(githubSource)) {
      errors.push("github-governance must retain the verified active permanent-branch ruleset identity");
    }
    if (!/include\s*=\s*\["refs\/heads\/main",\s*"refs\/heads\/develop"\]/.test(githubSource)) {
      errors.push("github-governance must scope the active ruleset to refs/heads/main and refs/heads/develop");
    }
  }

  for (const resource of manifest.resources ?? []) {
    if (!resource.expectedName) continue;
    const owningRoot = manifest.roots.find((entry) => entry.name === resource.root);
    const mainPath = path.join(root, owningRoot.directory, "main.tf");
    if (await exists(mainPath)) {
      const mainSource = await readFile(mainPath, "utf8");
      const escapedName = resource.expectedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`\\bname\\s*=\\s*"${escapedName}"`).test(mainSource)) {
        errors.push(`${resource.root} must retain the owned name ${resource.expectedName}`);
      }
    }
  }

  return { errors, manifest };
}

async function runCli() {
  const result = await validateOwnershipConfiguration();
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.log("Terraform ownership configuration passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
