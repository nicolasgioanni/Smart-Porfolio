import { parseDocument } from "yaml";
import { validateWorkflowGraph } from "./workflowGraph.mjs";

export function parseWorkflowYaml(source) {
  if (typeof source !== "string" || !source.trim() || Buffer.byteLength(source) > 512 * 1024) throw new Error("Workflow YAML is missing or exceeds its budget.");
  const document = parseDocument(source, { version: "1.2", uniqueKeys: true, prettyErrors: false });
  if (document.errors.length || document.warnings.length) throw new Error("Workflow YAML has invalid, ambiguous or duplicate configuration.");
  let workflow;
  try { workflow = document.toJS({ maxAliasCount: 100 }); }
  catch { throw new Error("Workflow YAML aliases are invalid or exceed their budget."); }
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) throw new Error("Workflow YAML must contain a job configuration object.");
  return workflow;
}

export function validateWorkflowYaml(source) {
  const workflow = parseWorkflowYaml(source);
  validateWorkflowGraph(workflow);
  return workflow;
}
