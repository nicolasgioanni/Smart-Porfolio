// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { afterEach, describe, expect, it } from "vitest";
import { parseContactPayload } from "../../functions/_shared/contact";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const sourcePath = path.join(projectRoot, "functions/_shared/contact/payload.ts");
const now = 1_768_160_000_000;
const submissionId = "4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9";
const temporaryDirectories = [];

function validPayload(overrides = {}) {
  return {
    submissionId,
    firstName: "Avery",
    lastName: "Nguyen",
    email: "avery@example.com",
    phone: "",
    message: "A focused contact validation guard test.",
    contactConsent: true,
    legalConsent: true,
    startedAt: now - 5_000,
    website: "",
    ...overrides
  };
}

async function loadExactMutant(label, original, replacement) {
  const source = await readFile(sourcePath, "utf8");
  const occurrences = source.split(original).length - 1;
  expect(occurrences, `${label} source guard must occur exactly once`).toBe(1);
  const mutated = source.replace(original, replacement);
  expect(mutated, `${label} mutation must alter exactly one guard`).not.toBe(source);

  const result = await build({
    bundle: true,
    format: "esm",
    platform: "node",
    sourcemap: false,
    target: "node22",
    write: false,
    stdin: {
      contents: mutated,
      loader: "ts",
      resolveDir: path.dirname(sourcePath),
      sourcefile: sourcePath
    }
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), "contact-guard-mutant-"));
  temporaryDirectories.push(directory);
  const filename = path.join(directory, `${label}.mjs`);
  await writeFile(filename, result.outputFiles[0].text);
  return import(pathToFileURL(filename).href);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

function assertContactBoundary(parsePayload, invalid) {
  expect(parsePayload(validPayload(), now)).toMatchObject({ kind: "valid", payload: { submissionId } });
  expect(parsePayload(invalid, now)).toEqual({ kind: "invalid" });
}

describe("contact payload critical-guard mutation checks", () => {
  it("kills exact unknown-schema, consent, and submission-ID mutants with the same focused boundary assertion", async () => {
    const focusedCases = [
      {
        label: "unknown-schema",
        original: 'if (Object.keys(value).some((key) => !CONTACT_KEYS.has(key))) return { kind: "invalid" };',
        replacement: 'if (false) return { kind: "invalid" };',
        invalid: validPayload({ unexpected: true })
      },
      {
        label: "literal-consent",
        original: "if (value.contactConsent !== true || value.legalConsent !== true) {",
        replacement: "if (false) {",
        invalid: validPayload({ legalConsent: false })
      },
      {
        label: "submission-id",
        original: 'const message = normalizedMultilineString(value.message);\n\n  if (!submissionId || !UUID_PATTERN.test(submissionId)) return { kind: "invalid" };',
        replacement: 'const message = normalizedMultilineString(value.message);\n\n  if (false) return { kind: "invalid" };',
        invalid: validPayload({ submissionId: "not-a-uuid" })
      }
    ];

    for (const currentCase of focusedCases) {
      expect(() => assertContactBoundary(parseContactPayload, currentCase.invalid), `${currentCase.label} original control`).not.toThrow();
      const mutant = await loadExactMutant(currentCase.label, currentCase.original, currentCase.replacement);
      expect(
        () => assertContactBoundary(mutant.parseContactPayload, currentCase.invalid),
        `${currentCase.label} mutant survived the shared focused boundary assertion`
      ).toThrow();
    }
  });
});
