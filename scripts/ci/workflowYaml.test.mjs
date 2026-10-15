import { describe, expect, it } from "vitest";
import { parseWorkflowYaml, validateWorkflowYaml } from "./workflowYaml.mjs";

describe("semantic GitHub workflow YAML parsing", () => {
  it("keeps on as an event key and handles native scalar, array and mapping triggers", () => {
    for (const value of ["push", "[push, pull_request]", "\n  push:\n  pull_request:"]) {
      expect(parseWorkflowYaml(`name: CI\non: ${value}\njobs: {}\n`)).toHaveProperty("on");
    }
  });

  it("rejects duplicate jobs, duplicate event keys and malformed alias references", () => {
    for (const source of [
      "name: CI\non: push\non: pull_request\njobs: {}\n",
      "jobs:\n  verify: {name: verify}\n  verify: {name: duplicate}\n",
      "jobs:\n  verify: *missing\n",
      "[CI, push, verify]", "", "x".repeat(512 * 1024 + 1)
    ]) expect(() => parseWorkflowYaml(source)).toThrow();
  });

  it("does not mistake valid syntax for a complete acceptance graph", () => {
    expect(() => validateWorkflowYaml("name: CI\non: [push, pull_request, schedule, workflow_dispatch]\njobs:\n  verify: {name: verify}\n")).toThrow("graph contract");
  });
});
