import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Skill, Step } from "./types.js";

export const REGISTERED_TOOLS = [
  "read_file",
  "list_directory",
  "run_python",
] as const;

const REQUIRED_FIELDS = ["name", "description", "system_prompt", "tools"] as const;

export function loadSkill(filePath: string): Skill {
  const content = readFileSync(filePath, "utf-8");

  let raw: unknown;
  try {
    raw = parse(content);
  } catch (err) {
    throw new Error(`Invalid YAML syntax: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Skill file must contain a YAML object");
  }

  const data = raw as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (typeof data["name"] !== "string") throw new Error("Field 'name' must be a string");
  if (typeof data["description"] !== "string") throw new Error("Field 'description' must be a string");
  if (typeof data["system_prompt"] !== "string") throw new Error("Field 'system_prompt' must be a string");
  if (!Array.isArray(data["tools"])) throw new Error("Field 'tools' must be an array");

  for (const tool of data["tools"] as unknown[]) {
    if (!REGISTERED_TOOLS.includes(tool as (typeof REGISTERED_TOOLS)[number])) {
      throw new Error(`Unknown tool: ${tool}`);
    }
  }

  let steps: Step[] | undefined;

  if (data["steps"] !== undefined) {
    if (!Array.isArray(data["steps"])) throw new Error("Field 'steps' must be an array");

    const seenIds = new Set<string>();
    steps = [];

    for (const step of data["steps"] as unknown[]) {
      if (typeof step !== "object" || step === null) {
        throw new Error("Each step must be an object");
      }
      const s = step as Record<string, unknown>;

      if (typeof s["id"] !== "string") throw new Error("Each step must have a string 'id' field");
      if (typeof s["prompt"] !== "string") throw new Error("Each step must have a string 'prompt' field");
      if (!s["id"]) throw new Error("Step 'id' must not be empty");
      if (!s["prompt"]) throw new Error("Step 'prompt' must not be empty");

      if (seenIds.has(s["id"])) throw new Error(`Duplicate step id: ${s["id"]}`);
      seenIds.add(s["id"]);

      steps.push({ id: s["id"], prompt: s["prompt"] });
    }
  }

  const skill: Skill = {
    name: data["name"] as string,
    description: data["description"] as string,
    system_prompt: data["system_prompt"] as string,
    tools: data["tools"] as string[],
  };

  if (steps !== undefined) skill.steps = steps;
  if (data["input"] !== undefined) skill.input = data["input"] as Record<string, string>;
  if (data["output"] !== undefined) skill.output = data["output"] as Record<string, string>;

  return skill;
}
