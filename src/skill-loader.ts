import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Skill } from "./types.js";

export const REGISTERED_TOOLS = [
  "read_file",
  "list_directory",
  "run_python",
] as const;

const REQUIRED_FIELDS = [
  "name",
  "description",
  "system_prompt",
  "tools",
] as const;

export function loadSkill(filePath: string): Skill {
  const content = readFileSync(filePath, "utf-8");

  let raw: unknown;
  try {
    raw = parse(content);
  } catch (err) {
    throw new Error(
      `Invalid YAML syntax: ${err instanceof Error ? err.message : String(err)}`
    );
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

  if (typeof data.name !== "string") {
    throw new Error("Field 'name' must be a string");
  }
  if (typeof data.description !== "string") {
    throw new Error("Field 'description' must be a string");
  }
  if (typeof data.system_prompt !== "string") {
    throw new Error("Field 'system_prompt' must be a string");
  }
  if (!Array.isArray(data.tools)) {
    throw new Error("Field 'tools' must be an array");
  }

  for (const tool of data.tools) {
    if (!REGISTERED_TOOLS.includes(tool as (typeof REGISTERED_TOOLS)[number])) {
      throw new Error(`Unknown tool: ${tool}`);
    }
  }

  if (data.steps !== undefined) {
    if (!Array.isArray(data.steps)) {
      throw new Error("Field 'steps' must be an array");
    }

    const seenIds = new Set<string>();
    for (const step of data.steps) {
      if (typeof step !== "object" || step === null) {
        throw new Error("Each step must be an object");
      }
      const s = step as Record<string, unknown>;
      if (!s.id) {
        throw new Error("Each step must have an 'id' field");
      }
      if (!s.prompt) {
        throw new Error("Each step must have a 'prompt' field");
      }
      if (typeof s.id !== "string") {
        throw new Error("Step 'id' must be a string");
      }
      if (typeof s.prompt !== "string") {
        throw new Error("Step 'prompt' must be a string");
      }
      if (seenIds.has(s.id)) {
        throw new Error(`Duplicate step id: ${s.id}`);
      }
      seenIds.add(s.id);
    }
  }

  return {
    name: data.name as string,
    description: data.description as string,
    system_prompt: data.system_prompt as string,
    tools: data.tools as string[],
    steps: data.steps as Skill["steps"],
    input: data.input as Skill["input"],
    output: data.output as Skill["output"],
  };
}
