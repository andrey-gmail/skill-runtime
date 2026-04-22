# Requirements Document — Skill Runtime

## Introduction

Minimal skill-runtime on Node.js (TypeScript) for running AI skills via Anthropic SDK. The runtime must support a single declarative skill format that works equally well in two modes: free exploration (model decides what to do) and strict pipeline (steps execute in fixed order). Both modes — one format, one runtime, no separate skill types.

Expected code volume: 300–500 lines. Stack: TypeScript, Node.js 20+, @anthropic-ai/sdk, pnpm.

## Glossary

- **Skill_Runtime** — the main system including Skill_Loader, Tool_Registry and Agent_Runner. Runs skills and manages LLM interaction.
- **Skill** — declarative task description for LLM in YAML format. Contains system prompt, available tools list, and optionally pipeline steps.
- **Skill_Loader** — component that reads skill YAML files, validates structure, and returns typed objects.
- **Tool_Registry** — registry of tools available to the model: read_file, list_directory, run_python. Routes tool calls to implementations.
- **Agent_Runner** — main LLM interaction loop. Sends prompts, handles tool calls, manages step transitions in pipeline mode.
- **Free_Mode** — skill mode without `steps` field. Model receives one system prompt and freely calls tools until task completion.
- **Pipeline_Mode** — skill mode with `steps` field. Runtime enforces step order by injecting each step's prompt separately.
- **Step** — one step in pipeline mode. Contains identifier and prompt. Model receives only the current step's prompt.
- **Tool_Call** — model's request to invoke a tool. Contains tool name and arguments.
- **Workspace_Dir** — working directory where the skill executes. All file operations and artifacts are bound to this directory.

## Requirements

### Requirement 1: Unified Skill Format

**User Story:** As a developer, I want to describe skills in a single YAML format so that one runtime can run both free and strictly sequential skills without separate types.

#### Acceptance Criteria

1. THE Skill SHALL contain required fields: `name` (string), `description` (string), `system_prompt` (string), `tools` (string array).
2. THE Skill SHALL contain an optional `steps` field (array of objects), whose presence switches Skill_Runtime to Pipeline_Mode.
3. WHEN `steps` field is absent from Skill, THE Skill_Runtime SHALL run Skill in Free_Mode.
4. WHEN `steps` field is present in Skill, THE Skill_Runtime SHALL run Skill in Pipeline_Mode.
5. THE Step SHALL contain required fields: `id` (string, unique within Skill) and `prompt` (string).
6. THE Skill SHALL contain an optional `input` field (object) describing skill input parameters.
7. THE Skill SHALL contain an optional `output` field (object) describing expected output artifacts.

### Requirement 2: Skill Loader

**User Story:** As a developer, I want to load skills from YAML files with validation to get typed objects and catch configuration errors before execution.

#### Acceptance Criteria

1. WHEN a YAML file path is passed to Skill_Loader, THE Skill_Loader SHALL read the file and return a typed Skill object.
2. IF a required field is missing from the YAML file, THEN THE Skill_Loader SHALL throw an error specifying the missing field name.
3. IF the `tools` field contains a tool name not registered in Tool_Registry, THEN THE Skill_Loader SHALL throw an error specifying the unknown tool.
4. IF `steps` field is present and contains a Step with duplicate `id`, THEN THE Skill_Loader SHALL throw an error specifying the duplicate identifier.
5. IF the YAML file contains a syntax error, THEN THE Skill_Loader SHALL throw an error describing the parsing problem.
6. WHEN Skill_Loader successfully loads a Skill, THE Skill_Loader SHALL return an object conforming to the TypeScript Skill interface.

### Requirement 3: Tool Registry

**User Story:** As a developer, I want a tool registry with a fixed set (read_file, list_directory, run_python) so the model can interact with the filesystem and execute Python code.

#### Acceptance Criteria

1. THE Tool_Registry SHALL provide a `read_file` tool that accepts a file path and returns file contents as a string.
2. THE Tool_Registry SHALL provide a `list_directory` tool that accepts a directory path and returns a list of file and subdirectory names.
3. THE Tool_Registry SHALL provide a `run_python` tool that accepts a Python code string and returns execution stdout.
4. WHEN `run_python` is invoked, THE Tool_Registry SHALL execute Python code via child_process with Workspace_Dir as working directory.
5. IF tool execution fails, THEN THE Tool_Registry SHALL return error text (stderr or exception message) instead of the result.
6. WHEN `run_python` is invoked, THE Tool_Registry SHALL limit execution time to a 30-second timeout.
7. IF `run_python` execution exceeds the timeout, THEN THE Tool_Registry SHALL kill the process and return a timeout message.
8. THE Tool_Registry SHALL provide a method to get registered tools and their JSON Schema descriptions for the Anthropic API.

### Requirement 4: Agent Runner — Free Mode

**User Story:** As a user, I want to run the csv-explore skill so the model freely investigates a CSV file and creates a markdown report without restrictions on action order.

#### Acceptance Criteria

1. WHEN a Skill is run in Free_Mode, THE Agent_Runner SHALL send the Skill's system_prompt and input data to Anthropic API as the initial message.
2. WHEN the model returns a Tool_Call in Free_Mode, THE Agent_Runner SHALL execute the called tool via Tool_Registry and return the result to the model.
3. WHEN the model returns a text response without Tool_Call in Free_Mode, THE Agent_Runner SHALL consider skill execution complete and return the final response.
4. IF the model requests a tool not listed in the Skill's `tools` field, THEN THE Agent_Runner SHALL reject the call and return an error message to the model specifying the unavailable tool.
5. THE Agent_Runner SHALL pass all Tool_Call results back into the conversation context to preserve interaction history.

### Requirement 5: Agent Runner — Pipeline Mode

**User Story:** As a user, I want to run the csv-prepare-for-ml skill so the runtime controls the order of step prompt injection, ensuring the model receives tasks strictly sequentially.

**Limitation:** The runtime controls prompt injection order but not the semantics of executed Python code. The model can theoretically execute code covering multiple steps within a single step. This is a fundamental limitation of any runtime without formal code verification.

#### Acceptance Criteria

1. WHEN a Skill is run in Pipeline_Mode, THE Agent_Runner SHALL execute Steps strictly in the order defined in the `steps` array.
2. WHEN Agent_Runner begins Step execution, THE Agent_Runner SHALL send the model only the current Step's prompt, not revealing subsequent Steps' prompts.
3. WHEN the model returns a text response without Tool_Call during Step execution, THE Agent_Runner SHALL consider the current Step complete and proceed to the next Step.
4. WHEN the last Step is complete, THE Agent_Runner SHALL consider skill execution complete.
5. IF the model requests a tool not listed in the Skill's `tools` field, THEN THE Agent_Runner SHALL reject the call and return an error message to the model.
6. THE Agent_Runner SHALL pass previous Steps' history into the conversation context so the model has access to previous step results.
7. THE Agent_Runner SHALL log the start and completion of each Step with its `id`.

### Requirement 6: Workspace and Data Transfer Between Steps

**User Story:** As a user, I want pipeline steps to share a working directory so that one step's artifacts are available to the next via the filesystem.

#### Acceptance Criteria

1. WHEN Skill_Runtime runs a Skill, THE Skill_Runtime SHALL create or use a Workspace_Dir for storing input files and intermediate artifacts.
2. THE Skill_Runtime SHALL pass the Workspace_Dir path in each Step's prompt so the model knows where to save and read files.
3. WHEN a Step in Pipeline_Mode creates a file in Workspace_Dir, THE Skill_Runtime SHALL ensure that file is available to subsequent Steps.
4. THE Tool_Registry SHALL execute all file operations (read_file, list_directory, run_python) relative to Workspace_Dir.
5. IF a path passed to a tool resolves outside Workspace_Dir, THEN THE Tool_Registry SHALL reject the operation and return an error message.

### Requirement 7: Skill csv-explore

**User Story:** As a user, I want to run the csv-explore skill on a CSV file to get a markdown report analyzing data structure, anomalies, and patterns.

#### Acceptance Criteria

1. THE csv-explore Skill SHALL be described in YAML format without a `steps` field (Free_Mode).
2. THE csv-explore Skill SHALL specify tools: read_file, list_directory, run_python.
3. THE csv-explore Skill SHALL contain a system_prompt guiding the model to investigate data structure, find anomalies, analyze distributions, and discover patterns.
4. WHEN csv-explore Skill completes, THE Agent_Runner SHALL return a markdown report as the final result.

### Requirement 8: Skill csv-prepare-for-ml

**User Story:** As a user, I want to run the csv-prepare-for-ml skill on a CSV file to get ML-ready data split into train and test sets.

#### Acceptance Criteria

1. THE csv-prepare-for-ml Skill SHALL be described in YAML format with a `steps` field (Pipeline_Mode).
2. THE csv-prepare-for-ml Skill SHALL contain exactly 4 Steps in this order: handle_missing, remove_duplicates, normalize, split.
3. THE handle_missing Step SHALL direct the model to handle all missing values in the dataset.
4. THE remove_duplicates Step SHALL direct the model to remove duplicate rows.
5. THE normalize Step SHALL direct the model to normalize all numeric columns.
6. THE split Step SHALL direct the model to split the dataset into train (80%) and test (20%) sets.
7. THE csv-prepare-for-ml Skill SHALL specify tools: read_file, run_python.

### Requirement 9: CLI Interface

**User Story:** As a developer, I want to run skills from the command line to quickly test and use the runtime.

#### Acceptance Criteria

1. THE Skill_Runtime SHALL provide a CLI command for running a skill, accepting a path to the skill YAML file and input parameters.
2. WHEN the CLI command is run, THE Skill_Runtime SHALL load the Skill via Skill_Loader, create Workspace_Dir, and start Agent_Runner.
3. THE Skill_Runtime SHALL output intermediate results (tool calls and their results) to stdout for observation.
4. WHEN skill execution completes, THE Skill_Runtime SHALL output the final result to stdout.
5. IF the ANTHROPIC_API_KEY environment variable is not set, THEN THE Skill_Runtime SHALL exit with an error message about the missing key.

### Requirement 10: Sample Runs

**User Story:** As a reviewer, I want to see examples of real runs of both skills to evaluate runtime functionality.

#### Acceptance Criteria

1. THE Skill_Runtime SHALL include a `samples/csv-explore-run.md` file with a recording of a real csv-explore skill run.
2. THE Skill_Runtime SHALL include a `samples/csv-prepare-for-ml-run.md` file with a recording of a real csv-prepare-for-ml skill run.
3. THE sample run SHALL contain: input data, sequence of tool calls with results, model's final response.
4. THE csv-prepare-for-ml sample run SHALL demonstrate sequential execution of all 4 steps in correct order.
