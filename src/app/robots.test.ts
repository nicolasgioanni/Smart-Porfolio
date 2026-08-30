import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots metadata route", () => {
  it("allows public crawling and disallows only approved technical paths", () => {
    const result = robots();

    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/content-version.json", "/artifact-integrity.json"]
    });
    expect(result.sitemap).toBe("https://nicolasmgioanni.dev/sitemap.xml");

    const serializedRules = JSON.stringify(result.rules);
    expect(serializedRules).not.toContain("/contact");
    expect(serializedRules).not.toContain("/_next/");
  });
});
