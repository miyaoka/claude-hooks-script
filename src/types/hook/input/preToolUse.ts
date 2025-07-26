import type { BaseHookInput } from "./base";

interface BasePreToolUseInput extends BaseHookInput {
  hook_event_name: "PreToolUse";
}

// Bash用の入力型
interface BashPreToolUseInput extends BasePreToolUseInput {
  tool_name: "Bash";
  tool_input: {
    command: string;
    description?: string;
    timeout?: number;
  };
}

// Read用の入力型
interface ReadPreToolUseInput extends BasePreToolUseInput {
  tool_name: "Read";
  tool_input: {
    file_path: string;
    offset?: number;
    limit?: number;
  };
}

// Write用の入力型
interface WritePreToolUseInput extends BasePreToolUseInput {
  tool_name: "Write";
  tool_input: {
    file_path: string;
    content: string;
  };
}

// Edit用の入力型
interface EditPreToolUseInput extends BasePreToolUseInput {
  tool_name: "Edit";
  tool_input: {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  };
}

// MultiEdit用の入力型
interface MultiEditPreToolUseInput extends BasePreToolUseInput {
  tool_name: "MultiEdit";
  tool_input: {
    file_path: string;
    edits: Array<{
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    }>;
  };
}

// Glob用の入力型
interface GlobPreToolUseInput extends BasePreToolUseInput {
  tool_name: "Glob";
  tool_input: {
    pattern: string;
    path?: string;
  };
}

// Grep用の入力型
interface GrepPreToolUseInput extends BasePreToolUseInput {
  tool_name: "Grep";
  tool_input: {
    pattern: string;
    path?: string;
    glob?: string;
    type?: string;
    output_mode?: "content" | "files_with_matches" | "count";
    "-A"?: number;
    "-B"?: number;
    "-C"?: number;
    "-i"?: boolean;
    "-n"?: boolean;
    multiline?: boolean;
    head_limit?: number;
  };
}

// LS用の入力型
interface LSPreToolUseInput extends BasePreToolUseInput {
  tool_name: "LS";
  tool_input: {
    path: string;
    ignore?: string[];
  };
}

// WebFetch用の入力型
interface WebFetchPreToolUseInput extends BasePreToolUseInput {
  tool_name: "WebFetch";
  tool_input: {
    url: string;
    prompt: string;
  };
}

// WebSearch用の入力型
interface WebSearchPreToolUseInput extends BasePreToolUseInput {
  tool_name: "WebSearch";
  tool_input: {
    query: string;
    allowed_domains?: string[];
    blocked_domains?: string[];
  };
}

// TodoWrite用の入力型
interface TodoWritePreToolUseInput extends BasePreToolUseInput {
  tool_name: "TodoWrite";
  tool_input: {
    todos: Array<{
      id: string;
      content: string;
      status: "pending" | "in_progress" | "completed";
      priority: "high" | "medium" | "low";
    }>;
  };
}

// NotebookRead用の入力型
interface NotebookReadPreToolUseInput extends BasePreToolUseInput {
  tool_name: "NotebookRead";
  tool_input: {
    notebook_path: string;
    cell_id?: string;
  };
}

// NotebookEdit用の入力型
interface NotebookEditPreToolUseInput extends BasePreToolUseInput {
  tool_name: "NotebookEdit";
  tool_input: {
    notebook_path: string;
    new_source: string;
    cell_id?: string;
    cell_type?: "code" | "markdown";
    edit_mode?: "replace" | "insert" | "delete";
  };
}

// Task用の入力型
interface TaskPreToolUseInput extends BasePreToolUseInput {
  tool_name: "Task";
  tool_input: {
    description: string;
    prompt: string;
    subagent_type: string;
  };
}

// ExitPlanMode用の入力型
interface ExitPlanModePreToolUseInput extends BasePreToolUseInput {
  tool_name: "ExitPlanMode";
  tool_input: {
    plan: string;
  };
}

// MCPツール用の入力型（mcp__で始まる）
interface MCPPreToolUseInput extends BasePreToolUseInput {
  tool_name: `mcp__${string}`;
  tool_input: Record<string, unknown>;
}

// 未知のツール用の入力型
interface UnknownPreToolUseInput extends BasePreToolUseInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export type PreToolUseInput =
  | BashPreToolUseInput
  | ReadPreToolUseInput
  | WritePreToolUseInput
  | EditPreToolUseInput
  | MultiEditPreToolUseInput
  | GlobPreToolUseInput
  | GrepPreToolUseInput
  | LSPreToolUseInput
  | WebFetchPreToolUseInput
  | WebSearchPreToolUseInput
  | TodoWritePreToolUseInput
  | NotebookReadPreToolUseInput
  | NotebookEditPreToolUseInput
  | TaskPreToolUseInput
  | ExitPlanModePreToolUseInput
  | MCPPreToolUseInput
  | UnknownPreToolUseInput;
