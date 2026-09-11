import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CONTACT_RESERVATION_INSERT_SQL } from "../functions/_shared/contact";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerEntrypoint = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const databaseBinding = "CONTACT_RATE_LIMIT_DB";
const nowSeconds = 1_800_000_000;
const expiresAt = nowSeconds + 86_400;
let persistenceDirectory: string | undefined;

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
