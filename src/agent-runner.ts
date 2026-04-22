import Anthropic from "@anthropic-ai/sdk";
import { execute, getToolDefinitions } from "./tool-registry.js";
import type { Skill, Step } from "./types.js";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
const MAX_TOKENS = 8192;
const MAX_ITERATIONS = 50;

const client = new Anthropic();

function buildSystemPrompt(skill: Skill, workspaceDir: string): string {
  return `${skill.system_prompt}\n\nWorkspace directory: ${workspaceDir}`;
}

function formatInput(input: Record<string, string>): string {
  return Object.entries(input).map(([key, value]) => `${key}: ${value}`).join("\n");
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
    const args = block.input as Record<string, unknown>;
    console.log(`[Tool] ${block.name}(${JSON.stringify(args)})`);

    let result: string;
    if (!skill.tools.includes(block.name)) {
      result = `Error: tool '${block.name}' is not available. Available: ${skill.tools.join(", ")}`;
    } else {
      result = await execute(block.name, args, workspaceDir);
    }

    console.log(`[Result] ${truncate(result)}`);
    results.push({ type: "tool_result", tool_use_id: block.id, content: result });
  }
  return results;
}

// Shared tool-use loop: runs until end_turn with no tool calls, or throws on MAX_ITERATIONS.
async function runLoop(
  messages: Anthropic.Messages.MessageParam[],
  skill: Skill,
  workspaceDir: string,
  system: string,
  tools: Anthropic.Messages.Tool[],
  label: string
): Promise<string> {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
    );

    // Only exit when end_turn AND no tool_use blocks — avoids skipping tool calls
    // that Anthropic API may return alongside end_turn in edge cases.
    if (response.stop_reason === "end_turn" && toolUseBlocks.length === 0) {
      return extractText(response.content);
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults = await handleToolCalls(toolUseBlocks, skill, workspaceDir);
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Exceeded maximum iterations (${MAX_ITERATIONS}) in ${label}`);
}

export async function runFree(
  skill: Skill,
  input: Record<string, string>,
  workspaceDir: string
): Promise<string> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: formatInput(input) },
  ];
  const tools = getToolDefinitions(skill.tools) as Anthropic.Messages.Tool[];
  const system = buildSystemPrompt(skill, workspaceDir);

  return runLoop(messages, skill, workspaceDir, system, tools, "free mode");
}

export async function runPipeline(
  skill: Skill,
  input: Record<string, string>,
  workspaceDir: string,
  steps: Step[]
): Promise<string> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: formatInput(input) },
  ];
  const tools = getToolDefinitions(skill.tools) as Anthropic.Messages.Tool[];
  const system = buildSystemPrompt(skill, workspaceDir);
  let lastResponse = "";

  for (const step of steps) {
    console.log(`[Step ${step.id}] starting...`);
    messages.push({ role: "user", content: `Step: ${step.prompt}` });
    lastResponse = await runLoop(messages, skill, workspaceDir, system, tools, `step '${step.id}'`);
    // runLoop appends assistant response to messages internally on tool calls,
    // but on clean exit we need to append the final assistant turn for history.
    messages.push({ role: "assistant", content: lastResponse });
    console.log(`[Step ${step.id}] completed`);
  }

  return lastResponse;
}

export async function run(
  skill: Skill,
  input: Record<string, string>,
  workspaceDir: string
): Promise<string> {
  const { steps } = skill;
  if (steps && steps.length > 0) {
    return runPipeline(skill, input, workspaceDir, steps);
  }
  return runFree(skill, input, workspaceDir);
}
