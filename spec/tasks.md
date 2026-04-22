# Implementation Plan: Skill Runtime

## Overview

Incremental implementation of a minimal skill-runtime in TypeScript: from project structure and types → through Skill Loader and Tool Registry → to Agent Runner and CLI → final artifacts (skills, samples, README, NOTES). Each step builds on the previous, tests go alongside implementation.

## Tasks

- [x] 1. Project initialisation and base types
  - [x] 1.1 Create project structure and configure environment
    - Create `solution/` directory with structure: `solution/src/`, `solution/skills/csv-explore/`, `solution/skills/csv-prepare-for-ml/`, `solution/samples/`, `solution/spec/`
    - Initialise `pnpm init` inside `solution/`, install dependencies: `typescript`, `tsx`, `@anthropic-ai/sdk`, `yaml`, `vitest`, `fast-check`
    - Configure `solution/tsconfig.json` (target: ES2022, module: NodeNext, strict: true)
    - Add scripts to `solution/package.json`: `test`, `build`, `start`
    - All paths in subsequent tasks are relative to `solution/`
    - _Requirements: 9.1, 9.2_

  - [x] 1.2 Define TypeScript interfaces and types
    - Create `solution/src/types.ts` with interfaces: `Skill`, `Step`, `ToolDefinition`
    - `Skill`: required fields `name`, `description`, `system_prompt`, `tools`; optional `steps`, `input`, `output`
    - `Step`: required fields `id`, `prompt`
    - `ToolDefinition`: `name`, `description`, `input_schema` (for Anthropic API)
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7_

- [x] 2. Skill Loader — YAML loading and validation
  - [x] 2.1 Implement Skill Loader
    - Create `solution/src/skill-loader.ts`
    - Read YAML file via `fs.readFileSync` + parse via `yaml` library
    - Validate required fields: `name`, `description`, `system_prompt`, `tools`
    - Validate `tools`: each tool must be from the registered list (`read_file`, `list_directory`, `run_python`)
    - Validate `steps`: if present — check required fields `id`, `prompt` and uniqueness of `id`
    - Throw errors specifying the concrete problem (field name, tool name, duplicate id)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.2 Write property-based test: Skill loading round-trip
    - **Property 1: Skill loading round-trip**
    - Generate random valid Skill objects, serialize to YAML, load via Skill Loader, compare with original
    - **Validates: Requirements 2.1, 2.6, 1.1, 1.5**

  - [ ]* 2.3 Write property-based test: Skill error validation
    - **Property 2: Skill error validation**
    - Generate YAML objects with missing required fields, unregistered tools, duplicate step ids
    - Verify that Skill Loader throws an error specifying the concrete problem
    - **Validates: Requirements 2.2, 2.3, 2.4, 1.1, 1.5**

  - [ ]* 2.4 Write property-based test: Mode selection by steps presence
    - **Property 3: Mode selection by steps presence**
    - Generate skills with/without `steps` field, verify mode is determined correctly
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ]* 2.5 Write unit tests for Skill Loader
    - Loading valid skill without steps (csv-explore format)
    - Loading valid skill with steps (csv-prepare-for-ml format)
    - Error on missing required field
    - Error on unknown tool
    - Error on duplicate step id
    - Error on invalid YAML syntax
    - _Requirements: 2.1–2.6_

- [x] 3. Tool Registry — tool registry
  - [x] 3.1 Implement Tool Registry
    - Create `solution/src/tool-registry.ts`
    - Implement `read_file`: read file relative to workspaceDir, return contents or error string
    - Implement `list_directory`: list files/directories relative to workspaceDir, return list or error string
    - Implement `run_python`: execute Python code via `child_process.execSync`, cwd = workspaceDir, timeout 30s
    - Implement `execute(name, args, workspaceDir)`: route calls to implementations
    - Implement `getToolDefinitions(allowedTools)`: return JSON Schema descriptions for Anthropic API
    - All tool errors returned as strings (no throw)
    - Path traversal protection: paths outside workspaceDir are rejected
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 6.4, 6.5_

  - [ ]* 3.2 Write property-based test: Tool errors returned as strings
    - **Property 4: Tool errors returned as strings**
    - Generate invalid tool inputs (non-existent paths, invalid Python code)
    - Verify result is a string, not an exception
    - **Validates: Requirements 3.5, 3.7**

  - [ ]* 3.3 Write property-based test: File paths resolve relative to workspace
    - **Property 8: File paths resolve relative to workspace**
    - Generate random relative paths, verify resolution relative to workspaceDir
    - Verify absolute paths outside workspaceDir are rejected
    - **Validates: Requirements 6.4, 6.2**

  - [ ]* 3.4 Write unit tests for Tool Registry
    - `read_file` returns contents of existing file
    - `read_file` returns error string for non-existent file
    - `list_directory` returns file list
    - `run_python` executes code and returns stdout
    - `run_python` returns stderr on error
    - `run_python` aborts on timeout
    - `getToolDefinitions` returns correct JSON Schema
    - _Requirements: 3.1–3.8_

- [x] 4. Checkpoint — Skill Loader and Tool Registry
  - Verify all tests pass, ask user if there are questions.

- [x] 5. Agent Runner — main loop
  - [x] 5.1 Implement Agent Runner — free mode
    - Create `solution/src/agent-runner.ts`
    - Implement `runFree(skill, input, workspaceDir)`:
      - Form system message from `system_prompt`
      - Form first user message from `input`
      - Tool-use loop: send → receive → if tool_call — execute via Tool Registry → send result → repeat
      - Verify requested tool is in skill's `tools` list
      - Complete on `stop_reason: "end_turn"` without tool_calls
      - If skill has `output` field — after completion verify presence of listed artifacts in Workspace_Dir
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Implement Agent Runner — pipeline mode
    - Implement `runPipeline(skill, input, workspaceDir)`:
      - Form system message from `system_prompt`
      - Loop over `steps`: inject current step prompt as user message
      - Tool-use loop within each step
      - Transition to next step on receiving text without tool_calls
      - Preserve previous step history in context
      - Log start and completion of each step with its `id`
      - If skill has `output` field — after last step verify presence of listed artifacts in Workspace_Dir
    - Implement single entry point `run(skill, input, workspaceDir)` with mode selection by `steps` presence
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 4.6_

  - [ ]* 5.3 Write property-based test: Disallowed tools are rejected
    - **Property 5: Disallowed tools are rejected**
    - Generate tool_calls with tool names not in skill's `tools` list
    - Verify Agent Runner returns error message to model without executing the call
    - **Validates: Requirements 4.4, 5.5**

  - [ ]* 5.4 Write property-based test: Pipeline executes steps strictly in order
    - **Property 6: Pipeline executes steps strictly in order with isolation**
    - Generate skills with N steps, mock Anthropic API
    - Verify prompts are injected strictly in the order defined in `steps`
    - Verify model at each step does not see subsequent step prompts
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ]* 5.5 Write property-based test: Pipeline preserves history
    - **Property 7: Pipeline preserves history**
    - Generate pipeline with N steps, verify that at step K context contains results of steps 0..K-1
    - **Validates: Requirements 5.6, 4.5**

  - [ ]* 5.6 Write unit tests for Agent Runner
    - Free mode: full run with mock API (prompt → tool_call → result → final text)
    - Pipeline mode: run with 4 steps, order verification
    - Disallowed tool rejection in both modes
    - _Requirements: 4.1–4.5, 5.1–5.7_

- [x] 6. CLI — entry point
  - [x] 6.1 Implement CLI
    - Create `solution/src/cli.ts`
    - Parse arguments via `process.argv` (no frameworks): path to YAML, `--input key=value`, `--workspace path`
    - Check `ANTHROPIC_API_KEY` in env
    - Load skill via Skill Loader
    - Run Agent Runner
    - Output tool calls and results to stdout
    - Output final result
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 6.2 Write unit tests for CLI
    - Error on missing ANTHROPIC_API_KEY
    - Correct argument parsing
    - _Requirements: 9.1, 9.5_

- [x] 7. Checkpoint — full runtime
  - Verify all tests pass, ask user if there are questions.

- [x] 8. Skill files and final artifacts
  - [x] 8.1 Create skill YAML files
    - Create `solution/skills/csv-explore/skill.yaml` — free mode, tools: read_file, list_directory, run_python
    - Create `solution/skills/csv-prepare-for-ml/skill.yaml` — pipeline mode, 4 steps: handle_missing, remove_duplicates, normalize, split
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 8.2 Create sample runs
    - Create `solution/samples/csv-explore-run.md` — recording of real csv-explore run: input data, tool calls, final report
    - Create `solution/samples/csv-prepare-for-ml-run.md` — recording of real csv-prepare-for-ml run: 4 steps in order, tool calls, results
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 8.3 Create README.md
    - Create `solution/README.md`
    - Installation instructions (pnpm install)
    - Run instructions (npx tsx src/cli.ts ...)
    - Skill format description
    - Warning about run_python without sandbox
    - Note: paths with spaces in --input must be quoted
    - _Requirements: 9.1_

  - [x] 8.4 Create NOTES.md
    - Create `solution/NOTES.md`
    - Answer 3 questions from the assignment (max half a page):
      1. Where the unified format falls short for one of the skills
      2. What happens if step order is violated
      3. What in the architecture you disagree with
    - _Requirements: assignment_

  - [x] 8.5 Copy spec files
    - Copy `requirements.md` and `design.md` to `solution/spec/`
    - _Requirements: assignment (solution/ structure)_

- [x] 9. Final checkpoint
  - Verify all tests pass, project structure matches assignment, ask user if there are questions.

## Notes

- Tasks marked `*` are optional, can be skipped for a quick MVP
- Each task references specific requirements for traceability
- Checkpoints provide incremental validation
- Property-based tests validate universal correctness properties from design.md
- Unit tests validate specific examples and edge cases
