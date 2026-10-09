// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CONTACT_RESERVATION_INSERT_SQL } from "../functions/_shared/contact";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerEntrypoint = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const databaseBinding = "CONTACT_RATE_LIMIT_DB";
const nowSeconds = 1_800_000_000;
const expiresAt = nowSeconds + 86_400;
let persistenceDirectory: string | undefined;
let reservationRuntime: Miniflare;

type D1Execution = Array<{
  results: Array<Record<string, unknown>>;
  success: boolean;
}>;

function executeD1(args: string[]): D1Execution {
  const output = execFileSync(process.execPath, [wranglerEntrypoint, "d1", ...args, "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(output) as D1Execution;
}

function applyLocalMigrations(): void {
  if (!persistenceDirectory) throw new Error("Local D1 persistence directory was not initialized.");
  execFileSync(
    process.execPath,
    [
      wranglerEntrypoint,
      "d1",
      "migrations",
      "apply",
      databaseBinding,
      "--local",
      "--persist-to",
      persistenceDirectory
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
}

function quoteSqlValue(value: number | string): string {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("Expected a safe integer SQL parameter.");
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function bindReservationSql(values: [string, string, string, number, number]): string {
  return CONTACT_RESERVATION_INSERT_SQL.replace(/\?([1-5])/g, (_match, parameterIndex: string) => {
    const value = values[Number(parameterIndex) - 1];
    if (value === undefined) throw new Error(`Missing SQL parameter ${parameterIndex}.`);
    return quoteSqlValue(value);
  });
}

function localD1Arguments(command: string): string[] {
  if (!persistenceDirectory) throw new Error("Local D1 persistence directory was not initialized.");
  return [
    "execute",
    databaseBinding,
    "--local",
    "--persist-to",
    persistenceDirectory,
    "--command",
    command
  ];
}

function runReservation(values: [string, string, string, number, number]): void {
  const result = executeD1(localD1Arguments(bindReservationSql(values)));
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ success: true });
}

function readReservations(): Array<Record<string, unknown>> {
  const result = executeD1(
    localD1Arguments(
      "SELECT submission_id, email_hash, payload_hash, reserved_at, expires_at FROM contact_rate_reservations ORDER BY submission_id"
    )
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ success: true });
  return result[0].results;
}

afterEach(async () => {
  if (!persistenceDirectory) return;
  await rm(persistenceDirectory, { force: true, recursive: true });
  persistenceDirectory = undefined;
});

beforeAll(async () => {
  const reservationModule = path.join(projectRoot, "functions", "_shared", "contact", "reservation.ts");
  const fixtureSource = `
    import { reserveContactSubmission } from ${JSON.stringify(reservationModule)};

    const createTable = ${JSON.stringify(`CREATE TABLE contact_rate_reservations (
      submission_id TEXT PRIMARY KEY NOT NULL,
      email_hash TEXT NOT NULL,
      payload_hash TEXT,
      reserved_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`)};

    export default {
      async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/setup") {
          await env.CONTACT_RATE_LIMIT_DB.prepare(createTable).run();
          await env.CONTACT_RATE_LIMIT_DB.prepare("CREATE INDEX idx_contact_rate_reservations_email_expiry ON contact_rate_reservations (email_hash, expires_at)").run();
          return Response.json({ ok: true });
        }
        if (url.pathname === "/reserve") {
          const { payloads, now } = await request.json();
          const results = await Promise.all(payloads.map((payload) => reserveContactSubmission(payload, env, now)));
          return Response.json({ results });
        }
        if (url.pathname === "/rows") {
          const rows = await env.CONTACT_RATE_LIMIT_DB.prepare("SELECT submission_id, email_hash, payload_hash, reserved_at, expires_at FROM contact_rate_reservations ORDER BY submission_id").all();
          return Response.json(rows.results);
        }
        return new Response("Not found", { status: 404 });
      }
    };
  `;
  const bundled = await build({
    bundle: true,
    format: "esm",
    legalComments: "none",
    platform: "browser",
    stdin: { contents: fixtureSource, loader: "ts", resolveDir: projectRoot },
    target: "es2022",
    write: false
  });
  const script = bundled.outputFiles[0]?.text;
  if (!script) throw new Error("Unable to bundle the local D1 reservation fixture.");

  reservationRuntime = new Miniflare(
    convertV4MiniflareOptions({
      cf: false,
      port: 0,
      workers: [
        {
          name: "contact-reservation-fixture",
          modules: true,
          compatibilityDate: "2026-08-27",
          d1Databases: { CONTACT_RATE_LIMIT_DB: "contact-rate-reservations" },
          bindings: {
            CONTACT_FROM_EMAIL: "Nicolas Gioanni <noreply@mail.nicolasmgioanni.dev>",
            CONTACT_RECIPIENT_EMAIL: "private-owner@example.net",
            CONTACT_REPLY_TO_EMAIL: "ngioanni@uw.edu",
            TURNSTILE_SECRET_KEY: "turnstile_test_secret"
          },
          script
        }
      ]
    })
  );
  await reservationRuntime.ready;
}, 30_000);

afterAll(async () => {
  await reservationRuntime?.dispose();
});

describe("local D1 contact reservation migration", () => {
  it("preserves an existing payload fingerprint and refuses a third address reservation", async () => {
    persistenceDirectory = await mkdtemp(path.join(tmpdir(), "smart-portfolio-d1-"));
    applyLocalMigrations();

    const emailHash = "keyed-address-hash";
    runReservation(["11111111-1111-4111-8111-111111111111", emailHash, "original-payload", nowSeconds, expiresAt]);
    runReservation(["11111111-1111-4111-8111-111111111111", emailHash, "changed-payload", nowSeconds + 1, expiresAt + 1]);
    runReservation(["22222222-2222-4222-8222-222222222222", emailHash, "second-payload", nowSeconds + 2, expiresAt + 2]);
    runReservation(["33333333-3333-4333-8333-333333333333", emailHash, "third-payload", nowSeconds + 3, expiresAt + 3]);

    expect(readReservations()).toEqual([
      {
        submission_id: "11111111-1111-4111-8111-111111111111",
        email_hash: emailHash,
        payload_hash: "original-payload",
        reserved_at: nowSeconds,
        expires_at: expiresAt
      },
      {
        submission_id: "22222222-2222-4222-8222-222222222222",
        email_hash: emailHash,
        payload_hash: "second-payload",
        reserved_at: nowSeconds + 2,
        expires_at: expiresAt + 2
      }
    ]);
  }, 30_000);

});

describe("local D1 contact reservation worker", () => {
  it("serializes genuinely concurrent reservations inside a Worker-bound local D1 database", async () => {
    const setup = await reservationRuntime.dispatchFetch("https://fixture.test/setup", { method: "POST" });
    expect(setup.status).toBe(200);
    const payloads = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333"
    ].map((submissionId) => ({
      submissionId,
      firstName: "Avery",
      lastName: "Nguyen",
      email: "avery@example.com",
      phone: "",
      message: "A local D1 concurrency check.",
      contactConsent: true,
      legalConsent: true,
      startedAt: nowSeconds * 1_000,
      website: ""
    }));

    const reservationResponse = await reservationRuntime.dispatchFetch("https://fixture.test/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ now: nowSeconds * 1_000, payloads })
    });
    const { results } = (await reservationResponse.json()) as {
      results: Array<{ kind: string; retryAfterSeconds?: number }>;
    };
    const rowsResponse = await reservationRuntime.dispatchFetch("https://fixture.test/rows");
    const rows = (await rowsResponse.json()) as Array<Record<string, unknown>>;

    expect(results.filter((result) => result.kind === "reserved")).toHaveLength(2);
    expect(results).toContainEqual({ kind: "rate-limited", retryAfterSeconds: 86_400 });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.email_hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(row.payload_hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(JSON.stringify(row)).not.toContain("avery@example.com");
      expect(JSON.stringify(row)).not.toContain("local D1 concurrency");
    }
  }, 30_000);
});
