import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, normalize, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { ToolDefinition } from "./types.js";

const PYTHON_CMD = process.env.PYTHON_CMD || (process.platform === "win32" ? "python" : "python3");

function isInsideWorkspace(filePath: string, workspaceDir: string): boolean {
  const resolved = resolve(workspaceDir, filePath);
  const normalizedWorkspace = normalize(resolve(workspaceDir)).toLowerCase();
  const normalizedResolved = normalize(resolved).toLowerCase();
  return normalizedResolved.startsWith(normalizedWorkspace);
}

function readFile(args: Record<string, unknown>, workspaceDir: string): string {
  const filePath = args.path as string;
  if (!isInsideWorkspace(filePath, workspaceDir)) {
    return "Error: path outside workspace";
  }
  try {
    const fullPath = resolve(workspaceDir, filePath);
    return readFileSync(fullPath, "utf-8");
  } catch {
    return `Error: file not found: ${filePath}`;
  }
}

function listDirectory(args: Record<string, unknown>, workspaceDir: string): string {
  const dirPath = args.path as string;
  if (!isInsideWorkspace(dirPath, workspaceDir)) {
    return "Error: path outside workspace";
  }
  try {
    const fullPath = resolve(workspaceDir, dirPath);
    const entries = readdirSync(fullPath, { withFileTypes: true });
    return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n");
  } catch {
    return `Error: directory not found: ${dirPath}`;
  }
}

function runPython(args: Record<string, unknown>, workspaceDir: string): string {
  const code = args.code as string;
  const tmpFile = join(workspaceDir, `_tmp_${randomBytes(4).toString("hex")}.py`);
  try {
    writeFileSync(tmpFile, code, "utf-8");
    const result = execSync(`${PYTHON_CMD} ${JSON.stringify(tmpFile)}`, {
      timeout: 30000,
      cwd: workspaceDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result;
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "killed" in err &&
      (err as { killed: boolean }).killed
    ) {
      return "Error: execution timed out after 30 seconds";
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "stderr" in err &&
      typeof (err as { stderr: unknown }).stderr === "string" &&
      (err as { stderr: string }).stderr.length > 0
    ) {
      return (err as { stderr: string }).stderr;
    }
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  read_file: {
    name: "read_file",
    description: "Read the contents of a file relative to the workspace directory",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to workspace" },
      },
      required: ["path"],
    },
  },
  list_directory: {
    name: "list_directory",
    description: "List files and directories relative to the workspace directory",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path relative to workspace" },
      },
      required: ["path"],
    },
  },
  run_python: {
    name: "run_python",
    description: "Execute Python code in the workspace directory with a 30 second timeout",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Python code to execute" },
      },
      required: ["code"],
    },
  },
};

const TOOL_IMPLEMENTATIONS: Record<
  string,
  (args: Record<string, unknown>, workspaceDir: string) => string
> = {
  read_file: readFile,
  list_directory: listDirectory,
  run_python: runPython,
};

export async function execute(
  name: string,
  args: Record<string, unknown>,
  workspaceDir: string
): Promise<string> {
  const impl = TOOL_IMPLEMENTATIONS[name];
  if (!impl) {
    return `Error: unknown tool: ${name}`;
  }
  return impl(args, workspaceDir);
}

export function getToolDefinitions(allowedTools: string[]): ToolDefinition[] {
  return allowedTools
    .filter((name) => TOOL_DEFINITIONS[name] !== undefined)
    .map((name) => TOOL_DEFINITIONS[name]);
}
