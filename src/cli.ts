import { mkdirSync } from "node:fs";
import { loadSkill } from "./skill-loader.js";
import { run } from "./agent-runner.js";

function printUsage(): void {
  console.log("Usage: npx tsx src/cli.ts <skill.yaml> --input key=value [--workspace ./workspace]");
  console.log();
  console.log("Arguments:");
  console.log("  <skill.yaml>        Path to skill YAML file");
  console.log("  --input key=value   Input parameters (can be specified multiple times)");
  console.log("  --workspace path    Workspace directory (default: ./workspace)");
}

function parseArgs(argv: string[]): {
  skillPath: string;
  input: Record<string, string>;
  workspaceDir: string;
} {
  const args = argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const skillPath = args[0];
  const input: Record<string, string> = {};
  let workspaceDir = "./workspace";

  let i = 1;
  while (i < args.length) {
    if (args[i] === "--input" && i + 1 < args.length) {
      const pair = args[i + 1];
      const eqIndex = pair.indexOf("=");
      if (eqIndex === -1) {
        console.error(`Error: invalid --input format: "${pair}". Expected key=value`);
        process.exit(1);
      }
      input[pair.substring(0, eqIndex)] = pair.substring(eqIndex + 1);
      i += 2;
    } else if (args[i] === "--workspace" && i + 1 < args.length) {
      workspaceDir = args[i + 1];
      i += 2;
    } else {
      console.error(`Error: unknown argument: ${args[i]}`);
      printUsage();
      process.exit(1);
    }
  }

  return { skillPath, input, workspaceDir };
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set");
    process.exit(1);
  }

  const { skillPath, input, workspaceDir } = parseArgs(process.argv);

  const skill = loadSkill(skillPath);
  console.log(`Loaded skill: ${skill.name}`);
  console.log(`Mode: ${skill.steps && skill.steps.length > 0 ? "pipeline" : "free"}`);
  console.log(`Workspace: ${workspaceDir}`);
  console.log();

  mkdirSync(workspaceDir, { recursive: true });

  const result = await run(skill, input, workspaceDir);

  console.log();
  console.log("=".repeat(60));
  console.log("RESULT:");
  console.log("=".repeat(60));
  console.log(result);
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
