// @vitest-environment node
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let runtime: Miniflare;
let db: Awaited<ReturnType<Miniflare["getD1Database"]>>;
const now = 1_800_000_000_000;

beforeAll(async () => {
  const bundle = await build({ entryPoints: ["scripts/testSupport/contactQuotaWorker.ts"], bundle: true, write: false, format: "esm", platform: "browser", target: "es2022" });
  runtime = new Miniflare(convertV4MiniflareOptions({ cf: false, port: 0, workers: [{
    name: "contact-quota", modules: true, compatibilityDate: "2026-08-27", script: bundle.outputFiles[0].text,
    d1Databases: ["CONTACT_RATE_LIMIT_DB"], bindings: { TURNSTILE_SECRET_KEY: "fixture-secret" }
  }] }));
  await runtime.ready;
  db = await runtime.getD1Database("CONTACT_RATE_LIMIT_DB");
  for (const name of ["0001_contact_rate_reservations.sql", "0002_contact_payload_fingerprint.sql", "0003_contact_delivery_rendering.sql", "0004_contact_ip_quota.sql"]) {
    const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
}, 20_000);
beforeEach(async () => { await db.prepare("DELETE FROM contact_rate_reservations").run(); });
afterAll(async () => { await runtime?.dispose(); });

async function reserve(id: string, email: string, ip: string, time = now) {
  const response = await runtime.dispatchFetch("https://quota.test/", { method: "POST", body: JSON.stringify({ id, email, ip, now: time }) });
  return await response.json() as { kind: string; retryAfterSeconds?: number; reservedAt?: number };
}

describe("atomic quotas in Workers and local D1", () => {
  it("admits only ten concurrent unique addresses from one canonical IP and preserves retries", async () => {
    const results = await Promise.all(Array.from({ length: 15 }, (_, n) => reserve(`id-${n}`, `user${n}@example.com`, "2001:0db8::1")));
    expect(results.filter((r) => r.kind === "reserved")).toHaveLength(10);
    expect(results.filter((r) => r.kind === "rate-limited")).toHaveLength(5);
    expect(results.filter((r) => r.kind === "rate-limited").every((r) => r.retryAfterSeconds === 3600)).toBe(true);
    const winner = results.findIndex((r) => r.kind === "reserved");
    const originalRow = await db.prepare("SELECT ip_hash, reserved_at FROM contact_rate_reservations WHERE submission_id = ?").bind(`id-${winner}`).first();
    const retry = await reserve(`id-${winner}`, `user${winner}@example.com`, "203.0.113.99", now + 1000);
    expect(retry).toEqual(results[winner]);
    expect(await db.prepare("SELECT ip_hash, reserved_at FROM contact_rate_reservations WHERE submission_id = ?").bind(`id-${winner}`).first()).toEqual(originalRow);
    expect((await reserve("extra", "extra@example.com", "2001:db8:0:0:0:0:0:1", now + 3_599_000)).retryAfterSeconds).toBe(1);
    expect((await reserve("extra", "extra@example.com", "2001:db8::1", now + 3_600_000)).kind).toBe("reserved");
    const rows = await db.prepare("SELECT ip_hash FROM contact_rate_reservations").all();
    expect(rows.results.every((row: Record<string, unknown>) => typeof row.ip_hash === "string" && /^[A-Za-z0-9_-]{43}$/.test(row.ip_hash))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("2001:db8");
  }, 30_000);

  it("counts legacy rows globally and waits for all exhausted budgets to release", async () => {
    const seconds = now / 1000;
    for (let n = 0; n < 100; n++) {
      await db.prepare("INSERT INTO contact_rate_reservations (submission_id,email_hash,reserved_at,expires_at) VALUES (?,?,?,?)")
        .bind(`legacy-${n}`, `hash-${n}`, seconds - 100, seconds + 100 + n).run();
    }
    expect(await reserve("new", "new@example.com", "203.0.113.1")).toEqual({ kind: "rate-limited", retryAfterSeconds: 100 });
    expect((await reserve("new", "new@example.com", "203.0.113.1", now + 100_000)).kind).toBe("reserved");
    expect((await db.prepare("SELECT COUNT(*) AS count FROM contact_rate_reservations WHERE ip_hash IS NULL").first())?.count).toBe(99);
  }, 30_000);
  it("atomically admits one concurrent submission into the final global slot", async () => {
    const seconds = now / 1000;
    for (let n = 0; n < 99; n++) {
      await db.prepare("INSERT INTO contact_rate_reservations (submission_id,email_hash,reserved_at,expires_at) VALUES (?,?,?,?)")
        .bind(`legacy-${n}`, `hash-${n}`, seconds - 1, seconds + 500).run();
    }
    const results = await Promise.all(Array.from({ length: 12 }, (_, n) => reserve(`new-${n}`, `new${n}@example.com`, `203.0.113.${n + 1}`)));
    expect(results.filter((r) => r.kind === "reserved")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "rate-limited")).toHaveLength(11);
    expect(results.filter((r) => r.kind === "rate-limited").every((r) => r.retryAfterSeconds === 500)).toBe(true);
  }, 30_000);

  it("returns the latest release across all exhausted budgets and admits at that boundary", async () => {
    expect((await reserve("first", "same@example.com", "203.0.113.1")).kind).toBe("reserved");
    expect((await reserve("second", "same@example.com", "203.0.113.1", now + 1000)).kind).toBe("reserved");
    for (let n = 0; n < 8; n++) expect((await reserve(`ip-${n}`, `ip${n}@example.com`, "203.0.113.1", now + 2000)).kind).toBe("reserved");
    const seconds = now / 1000;
    for (let n = 0; n < 90; n++) {
      await db.prepare("INSERT INTO contact_rate_reservations (submission_id,email_hash,reserved_at,expires_at) VALUES (?,?,?,?)")
        .bind(`legacy-${n}`, `hash-${n}`, seconds - 1, seconds + 500).run();
    }
    expect(await reserve("blocked", "same@example.com", "203.0.113.1", now + 3000))
      .toEqual({ kind: "rate-limited", retryAfterSeconds: 86_397 });
    expect((await reserve("blocked", "same@example.com", "203.0.113.1", now + 86_400_000)).kind).toBe("reserved");
  }, 30_000);

  it("atomically enforces the email cap across concurrent IPs", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, n) => reserve(`email-${n}`, "same@example.com", `203.0.113.${n + 1}`)));
    expect(results.filter((r) => r.kind === "reserved")).toHaveLength(2);
    expect(results.filter((r) => r.kind === "rate-limited")).toHaveLength(6);
    expect(results.filter((r) => r.kind === "rate-limited").every((r) => r.retryAfterSeconds === 86_400)).toBe(true);
  });

  it("waits for enough legacy rows to expire when the prior total exceeds the new global cap", async () => {
    const seconds = now / 1000;
    for (let n = 0; n < 105; n++) {
      await db.prepare("INSERT INTO contact_rate_reservations (submission_id,email_hash,reserved_at,expires_at) VALUES (?,?,?,?)")
        .bind(`legacy-${n}`, `hash-${n}`, seconds - 1, seconds + n + 1).run();
    }
    expect(await reserve("new", "new@example.com", "203.0.113.1")).toEqual({ kind: "rate-limited", retryAfterSeconds: 6 });
    expect((await reserve("new", "new@example.com", "203.0.113.1", now + 5_000)).retryAfterSeconds).toBe(1);
    expect((await reserve("new", "new@example.com", "203.0.113.1", now + 6_000)).kind).toBe("reserved");
  }, 30_000);

});
