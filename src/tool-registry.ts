import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFile } from "node:child_process";
import { resolve, normalize, join, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.js";

const execFileAsync = promisify(execFile);
const PYTHON_CMD = process.env.PYTHON_CMD ?? (process.platform === "win32" ? "python" : "python3");

const MAX_OUTPUT_BYTES = 100_000;

function isInsideWorkspace(filePath: string, workspaceDir: string): boolean {
  const resolvedWorkspace = normalize(resolve(workspaceDir)).toLowerCase();
  const workspaceWithSep = resolvedWorkspace.endsWith(sep)
    ? resolvedWorkspace
    : resolvedWorkspace + sep;
  const resolvedPath = normalize(resolve(workspaceDir, filePath)).toLowerCase();
  // Allow exact match (the workspace dir itself) or paths inside it
  return resolvedPath === resolvedWorkspace || resolvedPath.startsWith(workspaceWithSep);
}

function readFile(args: Record<string, unknown>, workspaceDir: string): string {
  const filePath = args["path"];
  if (typeof filePath !== "string") return "Error: missing required argument 'path'";
  if (!isInsideWorkspace(filePath, workspaceDir)) {
    return "Error: path outside workspace";
  }
  try {
    return readFileSync(resolve(workspaceDir, filePath), "utf-8");
  } catch {
    return `Error: file not found: ${filePath}`;
  }
}

function listDirectory(args: Record<string, unknown>, workspaceDir: string): string {
  const dirPath = args["path"];
  if (typeof dirPath !== "string") return "Error: missing required argument 'path'";
  if (!isInsideWorkspace(dirPath, workspaceDir)) {
    return "Error: path outside workspace";
  }
  try {
    const entries = readdirSync(resolve(workspaceDir, dirPath), { withFileTypes: true });
    return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n");
  } catch {
    return `Error: directory not found: ${dirPath}`;
  }
}

async function runPython(args: Record<string, unknown>, workspaceDir: string): Promise<string> {
  const code = args["code"];
  if (typeof code !== "string") return "Error: missing required argument 'code'";
  const absWorkspace = resolve(workspaceDir);
  const tmpFile = join(absWorkspace, `_tmp_${randomBytes(4).toString("hex")}.py`);
  try {
    writeFileSync(tmpFile, code, "utf-8");
    const { stdout } = await execFileAsync(PYTHON_CMD, [tmpFile], {
      timeout: 30000,
      cwd: absWorkspace,
      maxBuffer: MAX_OUTPUT_BYTES,
    });
    return stdout;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null) {
      const e = err as { killed?: boolean; stderr?: string; message?: string };
      if (e.killed) return "Error: execution timed out after 30 seconds";
      if (e.stderr && e.stderr.length > 0) return e.stderr;
      if (e.message) return `Error: ${e.message}`;
    }
    return `Error: ${String(err)}`;
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

type ToolImpl = (args: Record<string, unknown>, workspaceDir: string) => string | Promise<string>;

const TOOL_IMPLEMENTATIONS: Record<string, ToolImpl> = {
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
  if (!impl) return `Error: unknown tool: ${name}`;
  return impl(args, workspaceDir);
}

export function getToolDefinitions(allowedTools: string[]): ToolDefinition[] {
  return allowedTools.flatMap((name) => {
    const def = TOOL_DEFINITIONS[name];
    return def ? [def] : [];
  });
}
