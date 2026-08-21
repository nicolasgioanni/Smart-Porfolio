import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const supportedVariables = [
  "PORTFOLIO_WORKBOOK_URL",
  "PORTFOLIO_REQUIRE_REMOTE_CONTENT",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_ALLOWED_HOSTNAMES",
  "RESEND_API_KEY",
  "CONTACT_RECIPIENT_EMAIL",
  "CONTACT_ALLOWED_ORIGINS",
  "CONTACT_FROM_EMAIL",
  "CONTACT_REPLY_TO_EMAIL"
];

describe("local environment configuration", () => {
  it("publishes one complete placeholder guide and no legacy env examples", async () => {
    const example = await readFile(path.join(projectRoot, ".env.example"), "utf8");

    for (const variable of supportedVariables) {
      expect(example).toMatch(new RegExp(`^${variable}=`, "m"));
    }

    expect(example).not.toContain("PORTFOLIO_RESUME_CSV_URL");
    expect(example).not.toContain("PORTFOLIO_GOOGLE_SHEET_URL");
    expect(example).not.toMatch(/PORTFOLIO_(?:PROFILE|LINKS|RESEARCH|PROJECTS|EXPERIENCE|RECOMMENDATIONS|EDUCATION|SKILLS|SITE_SETTINGS)_CSV_URL/);
    const extraEnvFiles = (await readdir(projectRoot))
      .filter((name) => (name.startsWith(".env") || name.startsWith(".dev.vars")) && name !== ".env")
      .sort();
    expect(extraEnvFiles).toEqual([".env.example"]);

    for (const variable of [
      "PORTFOLIO_WORKBOOK_URL",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY",
      "TURNSTILE_SECRET_KEY",
      "RESEND_API_KEY",
      "CONTACT_RECIPIENT_EMAIL",
      "CONTACT_FROM_EMAIL",
      "CONTACT_REPLY_TO_EMAIL"
    ]) {
      expect(example).toMatch(new RegExp(`^${variable}=$`, "m"));
    }
  });

  it("ignores local values while allowing the placeholder guide to be tracked", async () => {
    const gitignore = await readFile(path.join(projectRoot, ".gitignore"), "utf8");

    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });
});
