export const CANONICAL_SITE_ORIGIN = "https://nicolasmgioanni.dev";
export const CANONICAL_HOMEPAGE_URL = `${CANONICAL_SITE_ORIGIN}/`;
export const PREFERRED_SITE_NAME = "Nicolas Gioanni";
export const ALTERNATE_SITE_NAMES = Object.freeze([
  "Nicolas Gioanni Portfolio",
  "nicolasmgioanni.dev"
] as const);
export const SITE_LANGUAGE = "en-US";
export const OPEN_GRAPH_LOCALE = "en_US";

export const siteConfig = Object.freeze({
  canonicalOrigin: CANONICAL_SITE_ORIGIN,
  canonicalHomepage: CANONICAL_HOMEPAGE_URL,
  preferredName: PREFERRED_SITE_NAME,
  alternateNames: ALTERNATE_SITE_NAMES,
  language: SITE_LANGUAGE,
  openGraphLocale: OPEN_GRAPH_LOCALE
});

export function createCanonicalUrl(rootRelativePath: string): string {
  if (!rootRelativePath.startsWith("/") || rootRelativePath.startsWith("//")) {
    throw new TypeError("Canonical URLs require a root-relative path beginning with exactly one slash.");
  }

  if (rootRelativePath.includes("?") || rootRelativePath.includes("#")) {
    throw new TypeError("Canonical URLs cannot contain a query string or fragment.");
  }

  if (rootRelativePath.includes("\\") || rootRelativePath.includes("\0")) {
    throw new TypeError("Canonical URLs cannot contain backslashes or null bytes.");
  }

  const absoluteUrl = new URL(rootRelativePath, CANONICAL_HOMEPAGE_URL);

  if (absoluteUrl.origin !== CANONICAL_SITE_ORIGIN) {
    throw new TypeError("Canonical URLs must remain on the canonical site origin.");
  }

  return absoluteUrl.toString();
}
