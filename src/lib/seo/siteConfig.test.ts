import { describe, expect, it } from "vitest";
import {
  ALTERNATE_SITE_NAMES,
  CANONICAL_HOMEPAGE_URL,
  CANONICAL_SITE_ORIGIN,
  OPEN_GRAPH_LOCALE,
  PREFERRED_SITE_NAME,
  SITE_LANGUAGE,
  createCanonicalUrl,
  siteConfig
} from "@/lib/seo/siteConfig";

describe("canonical site configuration", () => {
  it("publishes the reviewed site identity", () => {
    expect(siteConfig).toEqual({
      canonicalOrigin: CANONICAL_SITE_ORIGIN,
      canonicalHomepage: CANONICAL_HOMEPAGE_URL,
      preferredName: PREFERRED_SITE_NAME,
      alternateNames: ALTERNATE_SITE_NAMES,
      language: SITE_LANGUAGE,
      openGraphLocale: OPEN_GRAPH_LOCALE
    });
    expect(CANONICAL_SITE_ORIGIN).toBe("https://nicolasmgioanni.dev");
    expect(CANONICAL_HOMEPAGE_URL).toBe("https://nicolasmgioanni.dev/");
    expect(PREFERRED_SITE_NAME).toBe("Nicolas Gioanni");
    expect(ALTERNATE_SITE_NAMES).toEqual(["Nicolas Gioanni Portfolio", "nicolasmgioanni.dev"]);
    expect(SITE_LANGUAGE).toBe("en-US");
    expect(OPEN_GRAPH_LOCALE).toBe("en_US");
  });

  it("constructs canonical homepage and detail URLs", () => {
    expect(createCanonicalUrl("/")).toBe("https://nicolasmgioanni.dev/");
    expect(createCanonicalUrl("/experience")).toBe("https://nicolasmgioanni.dev/experience");
  });

  it("URL-encodes valid canonical asset paths", () => {
    expect(createCanonicalUrl("/images/profile/Nicolas Gioanni Headshot.png")).toBe(
      "https://nicolasmgioanni.dev/images/profile/Nicolas%20Gioanni%20Headshot.png"
    );
  });

  it.each([
    "https://example.com/experience",
    "http://nicolasmgioanni.dev/experience",
    "//example.com/experience",
    "experience",
    "/\\example.com/experience"
  ])("rejects non-canonical or non-root-relative input %s", (value) => {
    expect(() => createCanonicalUrl(value)).toThrow(TypeError);
  });

  it.each(["/experience?source=search", "/experience#current", "/experience?source=search#current"])(
    "rejects query strings and fragments in %s",
    (value) => {
      expect(() => createCanonicalUrl(value)).toThrow(TypeError);
    }
  );
});
