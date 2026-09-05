// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { contactTldSource, downloadContactTlds, parseContactTlds } from "./updateContactTlds.mjs";
import { contactTldSnapshot, contactTopLevelDomains } from "../src/lib/contact/ianaTlds";

const snapshot = `# Version ${contactTldSnapshot.version}, Last Updated fixture\n${[...contactTopLevelDomains].map((tld) => tld.toUpperCase()).join("\n")}\n`;

describe("offline contact TLD snapshot and explicit updater", () => {
  it("keeps a complete, sorted, attributed snapshot that accepts real endings", () => {
    const parsed = parseContactTlds(snapshot);
    expect(parsed.tlds.length).toBeGreaterThan(1_000);
    expect(contactTldSnapshot.source).toBe(contactTldSource);
    expect(parsed.tlds).toEqual([...contactTopLevelDomains]);
    for (const tld of ["com", "gov", "org", "edu", "co", "dev", "museum", "xn--p1ai"]) expect(contactTopLevelDomains.has(tld)).toBe(true);
    for (const tld of ["con", "gomm", "invalid", "test", "example"]) expect(contactTopLevelDomains.has(tld)).toBe(false);
  });

  it("rejects incomplete, malformed, duplicated, and unsorted snapshots", () => {
    for (const input of [snapshot.replace("# Version", "# Invalid"), snapshot.slice(0, 200), snapshot + "ZZZZ\nZZZZ\n",
      snapshot.replace("COM\n", "<SCRIPT>\n"), snapshot.replace("COM\n", "ZZZZ\n")]) {
      expect(() => parseContactTlds(input)).toThrow();
    }
  });

  it("downloads only the fixed HTTPS source with a timeout and no redirects", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(snapshot));
    await expect(downloadContactTlds(fetcher)).resolves.toMatchObject({ version: contactTldSnapshot.version });
    expect(fetcher).toHaveBeenCalledWith(contactTldSource, expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }));
  });

  it("rejects failed, declared-oversized, streamed-oversized, and invalid UTF-8 downloads", async () => {
    for (const response of [new Response("failed", { status: 503 }), new Response("x", { headers: { "Content-Length": "131073" } }),
      new Response("x".repeat(131_073)), new Response(new Uint8Array([0xff]))]) {
      await expect(downloadContactTlds(vi.fn().mockResolvedValue(response))).rejects.toThrow();
    }
  });

  it("never downloads the list as part of a build or validation command", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.scripts["update:contact-tlds"]).toBe("node scripts/updateContactTlds.mjs");
    for (const [name, command] of Object.entries(pkg.scripts)) {
      if (name !== "update:contact-tlds") expect(command).not.toMatch(/update:contact-tlds|updateContactTlds\.mjs/);
    }
  });
});
