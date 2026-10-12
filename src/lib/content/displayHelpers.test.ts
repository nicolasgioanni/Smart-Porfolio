import { describe, expect, it } from "vitest";
import { getExternalLinkProps, getLinkKind } from "./displayHelpers";

describe("display link helpers", () => {
  it("classifies only parsed GitHub and LinkedIn hostnames as provider links", () => {
    expect(getLinkKind({ label: "Source", url: "https://github.com/example/project" })).toBe("github");
    expect(getLinkKind({ label: "Profile", url: "https://www.linkedin.com/in/example" })).toBe("linkedin");
    expect(getLinkKind({ label: "External", url: "https://github.com.example.test/project" })).toBe("external");
    expect(getLinkKind({ label: "External", url: "https://example.test/?next=github.com" })).toBe("external");
  });

  it("adds new-window protections only to parsed HTTP(S) URLs", () => {
    expect(getExternalLinkProps("HTTPS://example.test")).toEqual({ target: "_blank", rel: "noopener noreferrer" });
    expect(getExternalLinkProps("javascript:alert(1)")).toEqual({});
    expect(getExternalLinkProps("https://")).toEqual({});
    expect(getExternalLinkProps("/projects")).toEqual({});
  });
});
