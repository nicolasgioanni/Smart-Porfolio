// @vitest-environment node
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assessGitleaks, assessZizmor, capturePrivateOutput, parseSecurityScansCli, runSecurityScans, validateScannerSuppressions } from "./securityScans.mjs";

const scannerGatePath = path.join(import.meta.dirname, "securityScans.mjs");

async function createScanFixture({ policy = { schemaVersion: 1, suppressions: [] }, workflow = "name: fixture\non: push\n" } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-security-scan-fixture-"));
  const scannerPolicyPath = path.join(root, "scripts", "security", "scanner-suppressions.json");
  await mkdir(path.dirname(scannerPolicyPath), { recursive: true });
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await writeFile(scannerPolicyPath, `${JSON.stringify(policy)}\n`);
  await writeFile(path.join(root, ".github", "workflows", "ci.yml"), workflow);
  return { root, scannerPolicyPath, tempRoot: path.join(root, "temporary-output") };
}

async function writeScanner(root, name, source) {
  const pathname = path.join(root, name);
  await writeFile(pathname, `#!${process.execPath}\n${source}\n`, { mode: 0o700 });
  await chmod(pathname, 0o700);
  return pathname;
}

function gitleaksStub({ report, exitCode = 0, stderr = "" }) {
  return [
    'import { writeFileSync } from "node:fs";',
    'const reportIndex = process.argv.indexOf("--report-path");',
    'const reportPath = process.argv[reportIndex + 1];',
    ...(report === undefined ? [] : [`writeFileSync(reportPath, ${JSON.stringify(report)});`]),
    `process.stderr.write(${JSON.stringify(stderr)});`,
    `process.exit(${exitCode});`,
  ].join("\n");
}

function runProcess(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

describe("private security scanner gate", () => {
  it("accepts only the expected empty reports and records findings without report details", () => {
    expect(assessGitleaks({ started: true, exitCode: 0, report: [] })).toEqual({ tool: "gitleaks", status: "clean", findings: 0 });
    expect(assessZizmor({ started: true, exitCode: 0, report: [] })).toEqual({ tool: "zizmor", status: "clean", findings: 0 });
    expect(assessGitleaks({ started: true, exitCode: 1, report: [{ Secret: "not emitted" }] })).toEqual({ tool: "gitleaks", status: "findings", findings: 1 });
    expect(assessZizmor({ started: true, exitCode: 14, report: [{ ignored: false, feature: "not emitted" }] })).toEqual({ tool: "zizmor", status: "findings", findings: 1 });
  });

  it("fails closed for scanner errors and missing or inconsistent reports", () => {
    expect(assessGitleaks({ started: false, exitCode: null, report: [] }).status).toBe("error");
    expect(assessGitleaks({ started: true, exitCode: 2, report: [{ Secret: "not emitted" }] }).status).toBe("error");
    expect(assessGitleaks({ started: true, exitCode: 0, report: null }).status).toBe("error");
    expect(assessZizmor({ started: true, exitCode: 1, report: [] }).status).toBe("error");
    expect(assessZizmor({ started: true, exitCode: 0, report: [{ ignored: false, feature: "not emitted" }] }).status).toBe("error");
  });

  it("rejects expired, unreasoned, and malformed suppression entries", () => {
    const expired = { schemaVersion: 1, suppressions: [{ tool: "zizmor", rule: "template-injection", selector: "ci.yml:12", reason: "Reviewed shell interpolation is bounded.", expiresOn: "2026-10-08" }] };
    expect(() => validateScannerSuppressions(expired, { now: new Date("2026-10-09T00:00:00Z") })).toThrow("expired");

    const missingReason = { schemaVersion: 1, suppressions: [{ tool: "gitleaks", fingerprint: "generic-api-key:example", reason: "", expiresOn: "2026-12-31" }] };
    expect(() => validateScannerSuppressions(missingReason, { now: new Date("2026-10-09T00:00:00Z") })).toThrow("reason");
  });

  it("requires an explicit scanner mode, target, and private temporary root", () => {
    expect(parseSecurityScansCli(["--gitleaks", "/tools/gitleaks", "--gitleaks-mode", "git", "--target", ".", "--temp-root", "/tmp/scans"])).toMatchObject({ gitleaksMode: "git", target: "." });
    expect(() => parseSecurityScansCli(["--gitleaks", "/tools/gitleaks", "--gitleaks-mode", "git", "--target", "../repo", "--temp-root", "/tmp/scans"])).toThrow("invalid");
  });

  it("accepts only an ignored zizmor record covered by the exact active suppression", () => {
    const report = [{
      ident: "template-injection",
      ignored: true,
      locations: [{
        symbolic: { key: { Local: { verbatim_path: "./.github/workflows/ci.yml" } } },
        concrete: { location: { start_point: { row: 11, column: 7 } } },
      }],
    }];
    const suppressions = [{ tool: "zizmor", rule: "template-injection", selector: "ci.yml:12:8", reason: "The exact reviewed interpolation remains bounded.", expiresOn: "2026-12-31" }];
    expect(assessZizmor({ started: true, exitCode: 0, report, suppressions })).toEqual({ tool: "zizmor", status: "clean", findings: 0 });
    expect(assessZizmor({ started: true, exitCode: 0, report, suppressions: [] }).status).toBe("error");
  });

  it("fails safely if a private scanner-output stream cannot be opened", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-scan-stream-"));
    try {
      await expect(capturePrivateOutput(process.execPath, ["-e", "console.log('PRIVATE_SCANNER_DETAIL_MUST_NOT_APPEAR')"], {
        cwd: directory,
        stdoutPath: directory,
        stderrPath: path.join(directory, "stderr.log"),
      })).resolves.toEqual({ started: false, exitCode: null });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed through the runner for missing, malformed, and symlinked reports, then removes private output", async () => {
    const cases = [
      { name: "missing", source: gitleaksStub({}) },
      { name: "malformed", source: gitleaksStub({ report: "not valid JSON" }) },
      {
        name: "symlinked",
        source: [
          'import { symlinkSync, writeFileSync } from "node:fs";',
          'const reportPath = process.argv[process.argv.indexOf("--report-path") + 1];',
          'writeFileSync(`${reportPath}.target`, "[]");',
          'symlinkSync(`${reportPath}.target`, reportPath);',
        ].join("\n"),
      },
    ];
    for (const scanCase of cases) {
      const fixture = await createScanFixture();
      try {
        const scanner = await writeScanner(fixture.root, `${scanCase.name}-gitleaks`, scanCase.source);
        const results = await runSecurityScans({
          gitleaks: scanner,
          gitleaksMode: "dir",
          target: ".",
          tempRoot: fixture.tempRoot,
          root: fixture.root,
          scannerPolicyPath: fixture.scannerPolicyPath,
        });
        expect(results).toEqual([{ tool: "gitleaks", status: "error", findings: 0 }]);
        expect(await readdir(fixture.tempRoot)).toEqual([]);
      } finally {
        await rm(fixture.root, { recursive: true, force: true });
      }
    }
  });

  it("rejects expired registry entries and unmanaged inline suppressions before scanner execution", async () => {
    const expiredFixture = await createScanFixture({
      policy: { schemaVersion: 1, suppressions: [{ tool: "gitleaks", fingerprint: "generic-api-key:example", reason: "The temporary exception has a documented owner.", expiresOn: "2000-01-01" }] },
    });
    const inlineFixture = await createScanFixture({ workflow: "name: fixture\n# zizmor: ignore[template-injection]\non: push\n" });
    try {
      await expect(runSecurityScans({
        gitleaks: "/not-invoked",
        gitleaksMode: "dir",
        target: ".",
        tempRoot: expiredFixture.tempRoot,
        root: expiredFixture.root,
        scannerPolicyPath: expiredFixture.scannerPolicyPath,
      })).rejects.toThrow("expired");
      await expect(runSecurityScans({
        gitleaks: "/not-invoked",
        gitleaksMode: "dir",
        target: ".",
        tempRoot: inlineFixture.tempRoot,
        root: inlineFixture.root,
        scannerPolicyPath: inlineFixture.scannerPolicyPath,
      })).rejects.toThrow("unmanaged inline");
    } finally {
      await Promise.all([rm(expiredFixture.root, { recursive: true, force: true }), rm(inlineFixture.root, { recursive: true, force: true })]);
    }
  });

  it("keeps scanner stderr out of the public CLI result", async () => {
    const fixture = await createScanFixture();
    const sentinel = "PRIVATE_SCANNER_DETAIL_MUST_NOT_APPEAR";
    try {
      const scanner = await writeScanner(fixture.root, "stderr-gitleaks", gitleaksStub({ exitCode: 2, stderr: sentinel }));
      const result = await runProcess(process.execPath, [
        scannerGatePath,
        "--gitleaks", scanner,
        "--gitleaks-mode", "dir",
        "--target", ".",
        "--temp-root", fixture.tempRoot,
      ], fixture.root);
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).not.toContain(sentinel);
      expect(result.stderr).toContain("Security scanner gate failed without publishing scanner details.");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("executes a symlinked scanner gate and reports scanner failure summaries", async () => {
    const fixture = await createScanFixture();
    try {
      const scanner = await writeScanner(fixture.root, "failed-gitleaks", gitleaksStub({ exitCode: 2 }));
      const symlinkedGate = path.join(fixture.root, "security-scans-link.mjs");
      await symlink(scannerGatePath, symlinkedGate);
      const result = await runProcess(process.execPath, [
        symlinkedGate,
        "--gitleaks", scanner,
        "--gitleaks-mode", "dir",
        "--target", ".",
        "--temp-root", fixture.tempRoot,
      ], fixture.root);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("gitleaks: error; findings=0");
      expect(result.stderr).toContain("Security scanner gate failed without publishing scanner details.");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
