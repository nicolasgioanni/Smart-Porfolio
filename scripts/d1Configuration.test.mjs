import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const placeholderId = "00000000-0000-0000-0000-000000000000";

async function readWranglerConfig() {
  return JSON.parse(await readFile(path.join(projectRoot, "wrangler.jsonc"), "utf8"));
}

function bindingFrom(bindings) {
  return bindings?.find(({ binding }) => binding === "CONTACT_RATE_LIMIT_DB");
}

describe("contact D1 configuration", () => {
  it("declares isolated production and preview bindings with pinned remote UUIDs", async () => {
    const config = await readWranglerConfig();
    const production = bindingFrom(config.d1_databases);
    const preview = bindingFrom(config.env.preview.d1_databases);

    expect(production).toMatchObject({
      database_name: "smart-portfolio-contact-rate-limit-production",
      migrations_dir: "migrations",
      preview_database_id: "contact-rate-limit-local"
    });
    expect(preview).toMatchObject({
      database_name: "smart-portfolio-contact-rate-limit-preview",
      migrations_dir: "migrations"
    });
    expect(production.database_name).not.toBe(preview.database_name);

    for (const databaseId of [production.database_id, preview.database_id]) {
      expect(databaseId).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
      expect(databaseId).not.toBe(placeholderId);
    }
    expect(production.database_id).not.toBe(preview.database_id);
  });

  it("tracks the pseudonymous reservation schema, payload fingerprint, and cleanup indexes", async () => {
    const initialMigration = await readFile(
      path.join(projectRoot, "migrations", "0001_contact_rate_reservations.sql"),
      "utf8"
    );
    const fingerprintMigration = await readFile(
      path.join(projectRoot, "migrations", "0002_contact_payload_fingerprint.sql"),
      "utf8"
    );

    expect(initialMigration).toMatch(/CREATE TABLE IF NOT EXISTS contact_rate_reservations/);
    expect(initialMigration).toMatch(/submission_id TEXT PRIMARY KEY NOT NULL/);
    expect(initialMigration).toMatch(/email_hash TEXT NOT NULL/);
    expect(initialMigration).toMatch(/reserved_at INTEGER NOT NULL/);
    expect(initialMigration).toMatch(/expires_at INTEGER NOT NULL/);
    expect(initialMigration).toMatch(/ON contact_rate_reservations \(email_hash, expires_at\)/);
    expect(initialMigration).toMatch(/ON contact_rate_reservations \(expires_at\)/);
    expect(fingerprintMigration).toMatch(/ALTER TABLE contact_rate_reservations/);
    expect(fingerprintMigration).toMatch(/ADD COLUMN payload_hash TEXT/);
    expect(`${initialMigration}\n${fingerprintMigration}`).not.toMatch(
      /first_name|last_name|phone|message|recipient/i
    );
  });

  it("migrates an ignored local D1 database before Pages development", async () => {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
    const gitignore = await readFile(path.join(projectRoot, ".gitignore"), "utf8");

    expect(packageJson.scripts["db:migrate:local"]).toBe(
      "npx --no-install wrangler d1 migrations apply CONTACT_RATE_LIMIT_DB --local"
    );
    expect(packageJson.scripts["dev:pages"]).toContain("npm run db:migrate:local");
    expect(packageJson.scripts["dev:pages"].indexOf("db:migrate:local")).toBeLessThan(
      packageJson.scripts["dev:pages"].indexOf("wrangler pages dev")
    );
    expect(gitignore).toMatch(/^\.wrangler$/m);
  });

  it("migrates the selected database before uploading the Pages deployment", async () => {
    const workflow = await readFile(path.join(projectRoot, ".github", "workflows", "ci.yml"), "utf8");
    const migrationStep = workflow.indexOf("Validate the environment-specific D1 binding and apply migrations");
    const deployStep = workflow.indexOf("Deploy the verified export and Pages Function with pinned Wrangler");

    expect(migrationStep).toBeGreaterThan(-1);
    expect(deployStep).toBeGreaterThan(migrationStep);
    expect(workflow).toContain(
      "wrangler d1 migrations apply smart-portfolio-contact-rate-limit-preview --env preview --remote"
    );
    expect(workflow).toContain(
      "wrangler d1 migrations apply smart-portfolio-contact-rate-limit-production --remote"
    );
    expect(workflow).toContain("still has the non-deployable placeholder database ID");
  });
});
