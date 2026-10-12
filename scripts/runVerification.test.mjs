import { describe, expect, it } from "vitest";
import { resolveVerificationPlan, verificationPlans } from "./runVerification.mjs";

describe("verification runner", () => {
  it("prepares one generated snapshot before each public quality plan", () => {
    expect(verificationPlans).toEqual({
      verify: ["docs:check", "audit:check", "lint", "typecheck", "test"],
      priority: ["docs:check", "audit:check", "lint", "typecheck", "test:priority", "test:e2e:priority"],
      full: ["docs:check", "audit:check", "lint", "typecheck", "test", "test:e2e:full"]
    });
    expect(resolveVerificationPlan("priority")).toEqual(verificationPlans.priority);
    expect(() => resolveVerificationPlan("unknown")).toThrow("Unknown verification plan");
  });
});
