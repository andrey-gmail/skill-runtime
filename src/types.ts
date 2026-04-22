export interface Step {
  id: string;
  prompt: string;
}

export interface Skill {
  name: string;
  description: string;
  system_prompt: string;
  tools: string[];
  steps?: Step[];
  input?: Record<string, string>;
  output?: Record<string, string>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}
