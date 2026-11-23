import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { testIdentity } from "./receipts.mjs";

export function identityForTest(test, root) {
  const titles = [test.title];
  let parent = test.parent;
  while (parent?.type === "describe") {
    titles.unshift(parent.title);
    parent = parent.parent;
  }
  return testIdentity({
    project: test.parent.project()?.name,
    file: path.relative(root, test.location.file).split(path.sep).join("/"),
    titlePath: titles,
    repeatEachIndex: test.repeatEachIndex
  });
}

// This report is deliberately smaller than HTML/trace diagnostics: no absolute
// filesystem paths, stdout, error details, attachments, URLs or environment.
export default class BrowserEvidenceReporter {
  constructor(options = {}) {
    this.root = options.root ?? process.env.CI_BROWSER_ROOT ?? process.cwd();
    this.output = options.output ?? process.env.CI_BROWSER_REPORT;
    this.mode = options.mode ?? process.env.CI_BROWSER_REPORT_MODE;
    if (!this.output || !["discovery", "execution"].includes(this.mode)) {
      throw new Error("Browser evidence requires an output path and an explicit report mode.");
    }
    this.tests = [];
    this.errors = 0;
  }

  printsToStdio() { return false; }
  onBegin(_config, suite) { this.tests = suite.allTests(); }
  onError() { this.errors += 1; }

  async onEnd(result) {
    const identities = this.tests.map((test) => identityForTest(test, this.root));
    const cases = this.mode === "discovery" ? [] : this.tests.map((test, index) => {
      const skipAnnotations = test.annotations.filter((annotation) => annotation.type === "skip");
      return {
        identity: identities[index],
        attempts: test.results.map((attempt) => ({ status: attempt.status, durationMs: attempt.duration, retry: attempt.retry })),
        skipReason: test.results.at(-1)?.status === "skipped" && skipAnnotations.length === 1
          ? skipAnnotations[0].description ?? null : null
      };
    });
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, `${JSON.stringify({
      schemaVersion: 1,
      mode: this.mode,
      status: result.status,
      errorCount: this.errors,
      identities,
      cases,
      durationMs: result.duration
    })}\n`, { flag: "wx" });
  }
}
