import Ajv from "ajv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultProjectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readSchema(projectRoot, fileName) {
  return JSON.parse(await readFile(path.join(projectRoot, "infra", "schemas", fileName), "utf8"));
}

function diagnostic(label, errors) {
  return (errors ?? []).map((error) => {
    const property = error.params?.additionalProperty;
    const suffix = property ? ` (${property})` : "";
    return `${label} fails its checked-in schema at ${error.dataPath || "/"}: ${error.message}${suffix}`;
  });
}

/**
 * Validates the two private operator records against the versioned contracts.
 * Semantic identity checks stay in safePlanGuard so this function never treats
 * operator-supplied JSON as live provider or state evidence.
 */
export async function validatePrivateRecordSchemas({
  projectRoot = defaultProjectRoot,
  inventory,
  approval,
}) {
  const [inventorySchema, approvalSchema] = await Promise.all([
    readSchema(projectRoot, "private-runtime-inventory.schema.json"),
    readSchema(projectRoot, "plan-approval.schema.json"),
  ]);
  const ajv = new Ajv({ allErrors: true, jsonPointers: true });
  const validateInventory = ajv.compile(inventorySchema);
  const validateApproval = ajv.compile(approvalSchema);
  const errors = [];
  if (!validateInventory(inventory)) errors.push(...diagnostic("private runtime inventory", validateInventory.errors));
  if (!validateApproval(approval)) errors.push(...diagnostic("private plan approval", validateApproval.errors));
  return errors;
}
