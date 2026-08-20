import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import * as z from "zod/v4";

import {
  DiffRequestSchema,
  MachineSpecSchema,
  PathRequestSchema,
  SimulationRequestSchema,
  StepRequestSchema,
  ValidationRequestSchema,
} from "../src/model/schemas.js";

const root = resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const schemas = {
  "machine-spec.schema.json": MachineSpecSchema,
  "machine-validate-request.schema.json": ValidationRequestSchema,
  "machine-step-request.schema.json": StepRequestSchema,
  "machine-simulate-request.schema.json": SimulationRequestSchema,
  "machine-path-request.schema.json": PathRequestSchema,
  "machine-diff-request.schema.json": DiffRequestSchema,
};

const stale: string[] = [];
for (const [filename, schema] of Object.entries(schemas)) {
  const generated = `${JSON.stringify(z.toJSONSchema(schema, { unrepresentable: "any" }), null, 2)}\n`;
  const path = resolve(root, "schemas", filename);
  if (check) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== generated) stale.push(filename);
  } else writeFileSync(path, generated, "utf8");
}

if (stale.length > 0) {
  throw new Error(`Published schemas are stale: ${stale.join(", ")}. Run npm run generate:schemas.`);
}
if (!check) process.stdout.write(`Generated ${Object.keys(schemas).length} schemas.\n`);

