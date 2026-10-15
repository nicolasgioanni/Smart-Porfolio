// @vitest-environment node
import { describe, expect, it } from "vitest";
import { verifyTrustedAttestation } from "./verifyAttestation.mjs";

const expected = { repository: "nicolasmgioanni/Smart-Porfolio", sourceRef: "refs/heads/main", sourceSha: "a".repeat(40) };

function verified(overrides = {}) {
  // gh's current JSON flattens sigstore-go certificate extensions. In
  // particular, the repository field is sourceRepositoryURI, not a predicate.
  return [{ verificationResult: { signature: { certificate: { issuer: "https://token.actions.githubusercontent.com", sourceRepositoryURI: "https://github.com/nicolasmgioanni/Smart-Porfolio", sourceRepositoryRef: "refs/heads/main", sourceRepositoryDigest: "a".repeat(40), buildTrigger: "push", runnerEnvironment: "github-hosted", ...overrides } }, verifiedTimestamps: [{ type: "Tlog", timestamp: "2026-10-08T00:00:00Z" }] } }];
}

describe("attestation certificate policy", () => {
  it("accepts only cryptographically verified certificate evidence from the protected source", () => {
    expect(verifyTrustedAttestation(verified(), expected)).toEqual([{ repository: "https://github.com/nicolasmgioanni/Smart-Porfolio", sourceRef: "refs/heads/main", sourceSha: "a".repeat(40), trigger: "push" }]);
  });

  it("rejects an empty verified array and wrong certificate repository, ref, SHA, or trigger", () => {
    expect(() => verifyTrustedAttestation([], expected)).toThrow("No attestations");
    for (const overrides of [
      { sourceRepositoryURI: "https://github.com/attacker/repository" },
      { sourceRepositoryRef: "refs/heads/feature" },
      { sourceRepositoryDigest: "b".repeat(40) },
      { buildTrigger: "pull_request" }
    ]) {
      expect(() => verifyTrustedAttestation(verified(overrides), expected)).toThrow();
    }
  });

  it("does not read user-controlled predicate claims as identity evidence", () => {
    const value = verified();
    value[0].verificationResult.statement = { predicate: { buildDefinition: { externalParameters: { repository: "attacker/repository" } } } };
    expect(verifyTrustedAttestation(value, expected)).toHaveLength(1);
  });

  it("also accepts the nested certificate.extensions representation", () => {
    const value = verified();
    const certificate = value[0].verificationResult.signature.certificate;
    certificate.extensions = {
      sourceRepository: certificate.sourceRepositoryURI,
      sourceRepositoryRef: certificate.sourceRepositoryRef,
      sourceRepositoryDigest: certificate.sourceRepositoryDigest,
      buildTrigger: certificate.buildTrigger,
      runnerEnvironment: certificate.runnerEnvironment
    };
    delete certificate.sourceRepositoryURI;
    delete certificate.sourceRepositoryRef;
    delete certificate.sourceRepositoryDigest;
    delete certificate.buildTrigger;
    delete certificate.runnerEnvironment;
    expect(verifyTrustedAttestation(value, expected)).toHaveLength(1);
  });
});
