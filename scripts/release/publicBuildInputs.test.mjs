// @vitest-environment node
import { describe, expect, it } from "vitest";
import { effectivePublicBuildEnvironment, parsePublicBuildInputs, publicBuildInputDigest } from "./publicBuildInputs.mjs";

const inputs = {
  schemaVersion: 1,
  target: "preview",
  sourceCommit: "a".repeat(40),
  keyDigest: "b".repeat(64),
  lockfileDigest: "c".repeat(64),
  wranglerConfigDigest: "d".repeat(64),
  nodeVersion: "v22.23.3",
  nextVersion: "16.4.0",
  wranglerVersion: "4.148.0"
};

describe("public build input identity", () => {
  it("maps the preview variable into the only browser-visible runtime input", () => {
    expect(effectivePublicBuildEnvironment("preview", { NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY: "preview-key" })).toEqual({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "preview-key"
    });
    expect(effectivePublicBuildEnvironment("local", {})).toEqual({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "local-release-test-turnstile-site-key"
    });
  });

  it("preserves an unconfigured preview widget without using production credentials", () => {
    expect(effectivePublicBuildEnvironment("preview", { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "production-key" })).toEqual({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: ""
    });
    expect(effectivePublicBuildEnvironment("preview", { NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY: "" })).toEqual({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: ""
    });
  });

  it("rejects a missing production key and hashes canonical identities", () => {
    expect(() => effectivePublicBuildEnvironment("production", {})).toThrow("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(publicBuildInputDigest(inputs)).toMatch(/^[a-f0-9]{64}$/);
    expect(publicBuildInputDigest({ ...inputs, keyDigest: "e".repeat(64) })).not.toBe(publicBuildInputDigest(inputs));
    expect(() => parsePublicBuildInputs({ ...inputs, secret: "not allowed" })).toThrow("unsupported fields");
  });
});
