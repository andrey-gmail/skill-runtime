import Anthropic from "@anthropic-ai/sdk";
import { execute, getToolDefinitions } from "./tool-registry.js";
import type { Skill } from "./types.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const client = new Anthropic();

function formatInput(input: Record<string, string>, workspaceDir: string): string {
  const parts = Object.entries(input).map(([key, value]) => `${key}: ${value}`);
  parts.push(`workspace: ${workspaceDir}`);
  return parts.join("\n");
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function truncate(text: string, maxLen = 200): string {
  return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
}

async function handleToolCalls(
  toolUseBlocks: Anthropic.Messages.ToolUseBlock[],
  skill: Skill,
  workspaceDir: string
): Promise<Anthropic.Messages.ToolResultBlockParam[]> {
  const results: Anthropic.Messages.ToolResultBlockParam[] = [];
  for (const block of toolUseBlocks) {
    const toolName = block.name;
    const args = block.input as Record<string, unknown>;
    console.log(`[Tool] ${toolName}(${JSON.stringify(args)})`);

    let result: string;
    if (!skill.tools.includes(toolName)) {
      result = `Error: tool '${toolName}' is not available. Available: ${skill.tools.join(", ")}`;
    } else {
      result = await execute(toolName, args, workspaceDir);
    }

    console.log(`[Result] ${truncate(result)}`);
    results.push({ type: "tool_result", tool_use_id: block.id, content: result });
  }
  return results;
}

export async function runFree(
  skill: Skill,
  input: Record<string, string>,
  workspaceDir: string
): Promise<string> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: formatInput(input, workspaceDir) },
  ];
  const tools = getToolDefinitions(skill.tools) as Anthropic.Messages.Tool[];

  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: skill.system_prompt,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
    );

    if (response.stop_reason === "end_turn" && toolUseBlocks.length === 0) {
      return extractText(response.content);
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults = await handleToolCalls(toolUseBlocks, skill, workspaceDir);
    messages.push({ role: "user", content: toolResults });
  }
}

export async function runPipeline(
  skill: Skill,
  input: Record<string, string>,
  workspaceDir: string
): Promise<string> {
  const steps = skill.steps!;
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: formatInput(input, workspaceDir) },
  ];
  const tools = getToolDefinitions(skill.tools) as Anthropic.Messages.Tool[];
  let lastResponse = "";

  for (const step of steps) {
    console.log(`[Step ${step.id}] starting...`);
    messages.push({
      role: "user",
      content: `Step: ${step.prompt}\nWorkspace: ${workspaceDir}`,
    });

    while (true) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: skill.system_prompt,
        tools,
        messages,
      });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );

      if (response.stop_reason === "end_turn" && toolUseBlocks.length === 0) {
        lastResponse = extractText(response.content);
        messages.push({ role: "assistant", content: response.content });
        console.log(`[Step ${step.id}] completed`);
        break;
      }

      messages.push({ role: "assistant", content: response.content });
      const toolResults = await handleToolCalls(toolUseBlocks, skill, workspaceDir);
      messages.push({ role: "user", content: toolResults });
    }
  }

  return lastResponse;
}

export async function run(
  skill: Skill,
  input: Record<string, string>,
  workspaceDir: string
): Promise<string> {
  if (skill.steps && skill.steps.length > 0) {
    return runPipeline(skill, input, workspaceDir);
  }
  return runFree(skill, input, workspaceDir);
}
