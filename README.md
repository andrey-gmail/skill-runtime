# Skill Runtime

Minimal runtime for executing AI skills via Anthropic Claude API. Skills are defined in YAML — one format, two modes: free exploration and strict pipeline.

## Prerequisites

- Node.js 20+
- pnpm
- Python 3 with `pandas` and `numpy` (for `run_python` tool)

## Quick Start

```bash
cd solution
pnpm install
cp .env.example .env   # then edit .env and set your ANTHROPIC_API_KEY

# Copy your CSV into the workspace directory
mkdir -p workspace
cp /path/to/data.csv workspace/

npx tsx src/cli.ts skills/csv-explore/skill.yaml --input file=data.csv
```

## CLI Usage

```
npx tsx src/cli.ts <skill.yaml> --input key=value [--workspace ./workspace]
```

| Argument | Description |
|---|---|
| `<skill.yaml>` | Path to skill YAML file |
| `--input key=value` | Input parameters (repeatable) |
| `--workspace path` | Working directory (default: `./workspace`) |

Input files referenced in `--input` must be placed in the workspace directory
before running. The runtime resolves all file paths relative to workspace.

> **Note:** If a value in `--input` contains spaces, quote the entire argument: `--input "file=my data.csv"`

### Examples

Explore a CSV file (free mode):
```bash
npx tsx src/cli.ts skills/csv-explore/skill.yaml --input file=data.csv --workspace ./out
```

Prepare a CSV for ML (pipeline mode — 4 sequential steps):
```bash
npx tsx src/cli.ts skills/csv-prepare-for-ml/skill.yaml --input file=data.csv
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (required) | — |
| `ANTHROPIC_MODEL` | Model to use | `claude-sonnet-4-20250514` |
| `PYTHON_CMD` | Python executable | `python` on Windows, `python3` elsewhere |

## Skill YAML Format

A skill is a YAML file with required fields `name`, `description`, `system_prompt`, `tools` and optional `steps`, `input`, `output`.

**Free mode** (no `steps`) — the model acts autonomously:
```yaml
name: csv-explore
description: Explore a CSV file
tools: [read_file, list_directory, run_python]
system_prompt: |
  You are a data analyst. Explore the CSV and produce a report.
input:
  file: "path to CSV file"
```

**Pipeline mode** (with `steps`) — runtime injects step prompts in order:
```yaml
name: csv-prepare-for-ml
description: Prepare CSV for ML
tools: [read_file, run_python]
system_prompt: |
  You are a data engineer. Execute each step precisely.
steps:
  - id: handle_missing
    prompt: "Handle all missing values. Save to cleaned.csv."
  - id: remove_duplicates
    prompt: "Remove duplicate rows. Save to deduped.csv."
```

Available tools: `read_file`, `list_directory`, `run_python`.

## ⚠️ Security Warning

The `run_python` tool executes arbitrary Python code via `child_process` **without any sandbox**. It has full access to the filesystem and network within the workspace. Do not run untrusted skills.

## Project Structure

```
solution/
├── src/
│   ├── cli.ts            # CLI entry point
│   ├── agent-runner.ts   # LLM interaction loop (free + pipeline)
│   ├── skill-loader.ts   # YAML loading and validation
│   ├── tool-registry.ts  # Tool implementations
│   └── types.ts          # TypeScript interfaces
├── skills/
│   ├── csv-explore/          # Free-mode skill
│   └── csv-prepare-for-ml/   # Pipeline-mode skill (4 steps)
├── samples/              # Recorded run examples
├── spec/                 # Requirements and design docs
└── package.json
```

## Tests

```bash
pnpm test
```
